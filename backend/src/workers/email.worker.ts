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
// exactly like `nodemailer.createTestAccount()` is meant for.
let transporterPromise: Promise<nodemailer.Transporter> | null = null;
function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (config.smtp.auth.user && config.smtp.auth.pass) {
        return nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          auth: { user: config.smtp.auth.user, pass: config.smtp.auth.pass },
        });
      }
      const testAccount = await nodemailer.createTestAccount();
      console.log(`Auto-provisioned Ethereal account: ${testAccount.user}`);
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    })();
  }
  return transporterPromise;
}

async function getHourlyLimit(senderEmail: string) {
  const override = await rateLimitRedis.get(`senderlimit:${senderEmail}`);
  const n = parseInt(override || '', 10);
  return Number.isFinite(n) && n > 0 ? n : config.rateLimit.maxEmailsPerHourPerSender;
}

export const emailWorker = new Worker(
  'email-queue',
  async (job: Job) => {
    const { emailId, to, subject, body, senderEmail, userId } = job.data;

    // ── Rate limiting: Redis INCR keyed by sender + hour window. Safe across
    // any number of worker processes since the counter lives in Redis, not memory. ──
    const currentHour = new Date().toISOString().slice(0, 13); // e.g. 2026-09-27T14
    const rateLimitKey = `rate-limit:${senderEmail}:${currentHour}`;
    const limit = await getHourlyLimit(senderEmail);
    const currentCount = await rateLimitRedis.incr(rateLimitKey);
    if (currentCount === 1) await rateLimitRedis.expire(rateLimitKey, 3600);

    if (currentCount > limit) {
      await rateLimitRedis.decr(rateLimitKey); // give the slot back - this job never sent

      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const delay = nextHour.getTime() - Date.now();

      await prisma.email.update({ where: { id: emailId }, data: { status: 'RATE_LIMITED' } });

      // Only one Slack ping per sender per hour window, not one per delayed email.
      const notifKey = `slacknotif:${senderEmail}:${currentHour}`;
      const firstToHitLimit = await rateLimitRedis.setnx(notifKey, '1');
      if (firstToHitLimit) {
        await rateLimitRedis.expire(notifKey, 3600);
        await SlackService.notifyRateLimitHit(userId, senderEmail, limit);
      }

      // Re-enqueue into the next hour window under a fresh job id (this job
      // instance completes normally; the retry carries the send forward).
      await emailQueue.add('send-email', job.data, {
        jobId: `${emailId}:retry:${Date.now()}`,
        delay,
      });
      return;
    }

    // ── Idempotency guard: only a row not already SENT can be claimed. Protects
    // against double-send if two workers ever pick up the same logical job. ──
    const claimed = await prisma.email.updateMany({
      where: { id: emailId, status: { notIn: ['SENT'] } },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count === 0) return; // already sent

    try {
      const transporter = await getTransporter();
      const info = await transporter.sendMail({ from: senderEmail, to, subject, text: body, html: body });
      const previewUrl = nodemailer.getTestMessageUrl(info);

      const updated = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          etherealPreviewUrl: previewUrl ? String(previewUrl) : undefined,
        },
      });
      await EmailService.indexToSearch(updated);
    } catch (error: any) {
      const updated = await prisma.email.update({
        where: { id: emailId },
        data: { status: 'FAILED', error: error.message },
      });
      await EmailService.indexToSearch(updated);
      throw error; // let BullMQ's built-in attempts/backoff retry it
    }
  },
  {
    connection: redisConnection,
    concurrency: config.rateLimit.workerConcurrency,
    // Minimum spacing between sends, enforced worker-wide (mimics provider throttling).
    limiter: { max: 1, duration: config.rateLimit.minSendDelayMs },
  },
);

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
