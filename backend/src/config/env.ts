import dotenv from 'dotenv';
dotenv.config();

function num(val: string | undefined, fallback: number) {
  const n = parseInt(val || '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  elastic: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri:
      process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/api/auth/slack/callback',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: num(process.env.SMTP_PORT, 587),
    auth: {
      user: process.env.ETHEREAL_USER || '',
      pass: process.env.ETHEREAL_PASS || '',
    },
  },
  rateLimit: {
    // Global default; can be overridden per-sender at schedule time (see EmailService.scheduleBatch)
    maxEmailsPerHourPerSender: num(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER, 200),
    minSendDelayMs: num(process.env.MIN_SEND_DELAY_MS, 2000),
    workerConcurrency: num(process.env.WORKER_CONCURRENCY, 5),
  },
};
