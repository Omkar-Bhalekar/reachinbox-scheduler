import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import {
  redisConnection,
  rateLimitRedis,
} from '../config/redis';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import { SlackService } from '../services/slack.service';
import { EmailService } from '../services/email.service';
import { emailQueue } from '../queues/email.queue';

// Lazily create and cache a transporter.
//
// If explicit Ethereal credentials are configured, they are used.
// Otherwise Nodemailer creates a temporary Ethereal account.
let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (
        config.smtp.auth.user &&
        config.smtp.auth.pass
      ) {
        return nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          auth: {
            user: config.smtp.auth.user,
            pass: config.smtp.auth.pass,
          },
        });
      }

      const testAccount =
        await nodemailer.createTestAccount();

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

async function getHourlyLimit(
  senderEmail: string,
) {
  const override =
    await rateLimitRedis.get(
      `senderlimit:${senderEmail}`,
    );

  const n = parseInt(
    override || '',
    10,
  );

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

    /*
     * ============================================================
     * IDEMPOTENCY / DATABASE CLAIM
     * ============================================================
     *
     * The database is the source of truth for whether an email
     * attempt is allowed to proceed.
     *
     * We check BOTH:
     *
     * 1. The email status
     * 2. The BullMQ job ID currently stored in PostgreSQL
     *
     * The second check is important because a rate-limited email
     * can have an old/stale retry job in Redis.
     *
     * Example:
     *
     * DB:
     *   jobId = email123:retry:ABC
     *
     * Redis:
     *   email123:retry:ABC  <- valid
     *   email123:retry:XYZ  <- stale duplicate
     *
     * Only ABC is allowed to process the email.
     */
    const claimed =
      await prisma.email.updateMany({
        where: {
          id: emailId,

          status: {
            in: [
              'SCHEDULED',
              'FAILED',
              'RATE_LIMITED',
            ],
          },

          OR: [
            // A newly scheduled email may not have its BullMQ
            // job ID persisted yet because the worker can start
            // immediately after emailQueue.add().
            {
              status: 'SCHEDULED',
              jobId: null,
            },

            // Once PostgreSQL has a job ID, only that exact
            // BullMQ job is allowed to process the email.
            {
              jobId: String(job.id),
            },
          ],
        },

        data: {
          status: 'PROCESSING',
        },
      });

    /*
     * ============================================================
     * HOURLY RATE LIMIT
     * ============================================================
     *
     * This happens AFTER the DB claim.
     *
     * Therefore duplicate/stale BullMQ jobs cannot consume
     * hourly rate-limit capacity.
     *
     * Redis INCR is atomic and therefore safe across multiple
     * worker processes.
     */
    const currentHour =
      new Date()
        .toISOString()
        .slice(0, 13);

    const rateLimitKey =
      `rate-limit:${senderEmail}:${currentHour}`;

    const limit =
      await getHourlyLimit(senderEmail);

    const currentCount =
      await rateLimitRedis.incr(
        rateLimitKey,
      );

    if (currentCount === 1) {
      await rateLimitRedis.expire(
        rateLimitKey,
        3600,
      );
    }

    if (currentCount > limit) {
      /*
       * This email has NOT been sent.
       *
       * Give the rate-limit slot back because this email
       * did not consume an actual send slot.
       */
      await rateLimitRedis.decr(
        rateLimitKey,
      );

      /*
       * Schedule at the beginning of the next hour.
       */
      const nextHour = new Date();

      nextHour.setHours(
        nextHour.getHours() + 1,
        0,
        0,
        0,
      );

      const delay =
        nextHour.getTime() -
        Date.now();

      /*
       * Mark the email as waiting for the next
       * available rate-limit window.
       */
      await prisma.email.update({
        where: {
          id: emailId,
        },

        data: {
          status: 'RATE_LIMITED',
          scheduledAt: nextHour,
        },
      });

      /*
       * Only one Slack notification per sender/hour.
       */
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

      /*
       * Create the delayed retry job.
       *
       * The email ID is included in the job ID so that every
       * retry is uniquely identifiable.
       */
      const retryJob =
        await emailQueue.add(
          'send-email',
          job.data,
          {
            jobId:
              `${emailId}:retry:${Date.now()}`,
            delay,
          },
        );

      /*
       * IMPORTANT:
       *
       * PostgreSQL must point to the exact retry job that
       * was just created.
       *
       * This allows restart reconciliation and idempotency
       * checks to distinguish the valid retry from stale
       * duplicate jobs.
       */
      await prisma.email.update({
        where: {
          id: emailId,
        },

        data: {
          jobId: String(retryJob.id),
          scheduledAt: nextHour,
          status: 'RATE_LIMITED',
        },
      });

      return;
    }

    /*
     * ============================================================
     * SEND EMAIL
     * ============================================================
     */

    try {
      const transporter =
        await getTransporter();

      const info =
        await transporter.sendMail({
          from: senderEmail,
          to,
          subject,
          text: body,
          html: body,
        });

      const previewUrl =
        nodemailer.getTestMessageUrl(
          info,
        );

      /*
       * SMTP send succeeded.
       */
      const updated =
        await prisma.email.update({
          where: {
            id: emailId,
          },

          data: {
            status: 'SENT',
            sentAt: new Date(),

            etherealPreviewUrl:
              previewUrl
                ? String(previewUrl)
                : undefined,
          },
        });

      await EmailService.indexToSearch(
        updated,
      );
    } catch (error: any) {
      /*
       * SMTP failed.
       *
       * Mark the email as FAILED and let BullMQ's
       * configured retry/backoff mechanism retry it.
       */
      const updated =
        await prisma.email.update({
          where: {
            id: emailId,
          },

          data: {
            status: 'FAILED',
            error: error.message,
          },
        });

      await EmailService.indexToSearch(
        updated,
      );

      throw error;
    }
  },

  {
    connection: redisConnection,

    /*
     * Configurable worker concurrency.
     */
    concurrency:
      config.rateLimit.workerConcurrency,

    /*
     * Minimum spacing between sends.
     *
     * BullMQ ensures only one job is allowed through
     * this limiter during the configured duration.
     */
    limiter: {
      max: 1,
      duration:
        config.rateLimit.minSendDelayMs,
    },
  },
);

emailWorker.on(
  'failed',
  (job, err) => {
    console.error(
      `Job ${job?.id} failed:`,
      err.message,
    );
  },
);