import dotenv from 'dotenv';
dotenv.config();

function num(val: string | undefined, fallback: number) {
  const n = parseInt(val || '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function emailProvider(): 'ethereal' | 'resend' {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (configured === 'ethereal' || configured === 'resend') {
    return configured;
  }

  // Railway sets RAILWAY_ENVIRONMENT for deployed services. Keep the
  // zero-configuration local experience on Ethereal.
  return process.env.RAILWAY_ENVIRONMENT ? 'resend' : 'ethereal';
}

export const config = {
  port: num(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  authJwtSecret: process.env.AUTH_JWT_SECRET || '',
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
  email: {
    provider: emailProvider(),
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
      fromEmail: process.env.RESEND_FROM_EMAIL || '',
    },
  },
  rateLimit: {
    // Global default; can be overridden per-sender at schedule time (see EmailService.scheduleBatch)
    maxEmailsPerHourPerSender: num(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER, 200),
    minSendDelayMs: num(process.env.MIN_SEND_DELAY_MS, 2000),
    workerConcurrency: num(process.env.WORKER_CONCURRENCY, 5),
  },
};
