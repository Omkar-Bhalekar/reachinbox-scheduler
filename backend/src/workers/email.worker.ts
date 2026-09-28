import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisConnection, rateLimitRedis } from '../config/redis';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import { SlackService } from '../services/slack.service';
import { EmailService } from '../services/email.service';
import { emailQueue } from '../queues/email.queue';

// Lazily create (and cache) a transporter. If no Ethereal credentials are
// configured, auto-provision a throwaway Ethereal test account on first use,
// exactly like nodemailer.createTestAccount() is meant for.
let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (config.smtp.auth.user && config.smtp.auth.pass) {
        return nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          auth: {
            user: config.smtp.auth.user,
            pass: config.smtp.auth.pass,
          },
        });
      }

      const testAccount = await nodemailer.createTestAccount();

      console.log(
        `Auto-provisioned Ethereal account: ${testAccount.user}`,
      );

      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    })();
  }

  return transporterPromise;
}

async function getHourlyLimit(senderEmail: string) {
  const override = await rateLimitRedis.get(`senderlimit:${senderEmail}`);
  const n = parseInt(override || '', 10);

  return Number.isFinite(n) && n > 0
    ? n
    : config.rateLimit.maxEmailsPerHourPerSender;
}

export const emailWorker = new Worker(
  'email-queue',

  async (job: Job) => {
    const {
      emailId,
      to,
      subject,
      body,
      senderEmail,
      userId,
    } = job.data;

    // ─────────────────────────────────────────────────────────────
    // HOURLY RATE LIMIT
    // ─────────────────────────────────────────────────────────────

    // Redis INCR is atomic and therefore safe across multiple workers
    // or multiple backend processes.
    const currentHour = new Date().toISOString().slice(0, 13);

    const rateLimitKey =
      `rate-limit:${senderEmail}:${currentHour}`;

    const limit = await getHourlyLimit(senderEmail);

    const currentCount =
      await rateLimitRedis.incr(rateLimitKey);

    if (currentCount === 1) {
      await rateLimitRedis.expire(rateLimitKey, 3600);
    }

    if (currentCount > limit) {
      // This email has NOT been sent, so give the rate-limit slot back.
      await rateLimitRedis.decr(rateLimitKey);

      // Schedule for the beginning of the next hour.
      const nextHour = new Date();

      nextHour.setHours(
        nextHour.getHours() + 1,
        0,
        0,
        0,
      );

      const delay =
        nextHour.getTime() - Date.now();

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'RATE_LIMITED',
        },
      });

      // Only one Slack notification per sender per hour.
      const notifKey =
        `slacknotif:${senderEmail}:${currentHour}`;

      const firstToHitLimit =
        await rateLimitRedis.setnx(
          notifKey,
          '1',
        );

      if (firstToHitLimit) {
        await rateLimitRedis.expire(
          notifKey,
          3600,
        );

        await SlackService.notifyRateLimitHit(
          userId,
          senderEmail,
          limit,
        );
      }

      // Re-enqueue the email for the next hour.
      //
      // We use a new job ID because the original BullMQ job
      // is currently completing.
      await emailQueue.add(
        'send-email',
        job.data,
        {
          jobId: `${emailId}:retry:${Date.now()}`,
          delay,
        },
      );

      return;
    }

    // ─────────────────────────────────────────────────────────────
    // IDEMPOTENCY / DATABASE CLAIM
    // ─────────────────────────────────────────────────────────────

    /*
     * Only these states can start a send:
     *
     * SCHEDULED    -> first attempt
     * FAILED       -> BullMQ retry after an SMTP failure
     * RATE_LIMITED -> retry after the next hour
     *
     * PROCESSING is intentionally excluded.
     *
     * This prevents a stale/replayed job from sending the same email
     * again while another worker/process may already be processing it.
     *
     * SENT is also excluded, so an already-sent email cannot be sent
     * again by a duplicate BullMQ job.
     */
    const claimed = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: {
          in: [
            'SCHEDULED',
            'FAILED',
            'RATE_LIMITED',
          ],
        },
      },
      data: {
        status: 'PROCESSING',
      },
    });

    if (claimed.count === 0) {
      // The email is either already SENT or currently PROCESSING.
      // Do not send it again.
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // SEND EMAIL
    // ─────────────────────────────────────────────────────────────

    try {
      const transporter = await getTransporter();

      const info = await transporter.sendMail({
        from: senderEmail,
        to,
        subject,
        text: body,
        html: body,
      });

      const previewUrl =
        nodemailer.getTestMessageUrl(info);

      // SMTP send succeeded. Persist SENT state.
      const updated = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          etherealPreviewUrl: previewUrl
            ? String(previewUrl)
            : undefined,
        },
      });

      await EmailService.indexToSearch(updated);
    } catch (error: any) {
      // SMTP failed, so mark the email as FAILED.
      const updated = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          error: error.message,
        },
      });

      await EmailService.indexToSearch(updated);

      // Allow BullMQ's configured retry/backoff mechanism
      // to retry the failed job.
      throw error;
    }
  },

  {
    connection: redisConnection,

    // Configurable worker concurrency.
    concurrency:
      config.rateLimit.workerConcurrency,

    // Minimum spacing between sends.
    //
    // BullMQ enforces this worker-wide and prevents sends from
    // happening faster than the configured interval.
    limiter: {
      max: 1,
      duration:
        config.rateLimit.minSendDelayMs,
    },
  },
);

// Log failed BullMQ jobs.
emailWorker.on('failed', (job, err) => {
  console.error(
    `Job ${job?.id} failed:`,
    err.message,
  );
});