import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/env';
import { emailQueue } from './queues/email.queue';
import './workers/email.worker';
import { requireUser } from './middleware/auth';
import {
  scheduleEmail,
  listEmails,
  searchEmails,
} from './controllers/email.controller';
import {
  whoami,
  slackConnect,
  slackCallback,
  slackDisconnect,
} from './controllers/auth.controller';
import { EmailService } from './services/email.service';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

app.use(express.json());
app.use(morgan('dev'));

// Live BullMQ dashboard.
// Left open for local/demo use. A production deployment should
// protect this route with proper authentication.
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.get('/api/health', (_req, res) => {
  return res.json({ ok: true });
});

// Google-authenticated backend user
app.get('/api/auth/whoami', requireUser, whoami);

// Slack OAuth
//
// Connect is authenticated because the frontend calls it through
// apiClient, which forwards the verified Google identity headers.
//
// The callback is intentionally not protected by requireUser because
// Slack redirects the browser directly to this URL. The OAuth state
// stored in Redis identifies the initiating user.
app.post('/api/auth/slack/connect', requireUser, slackConnect);
app.get('/api/auth/slack/callback', slackCallback);
app.post('/api/auth/slack/disconnect', requireUser, slackDisconnect);

// Email APIs
app.post('/api/emails/schedule', requireUser, scheduleEmail);
app.get('/api/emails', requireUser, listEmails);
app.get('/api/emails/search', requireUser, searchEmails);

app.listen(config.port, async () => {
  console.log(`Server running on port ${config.port}`);
  console.log(
    `BullBoard UI available at http://localhost:${config.port}/admin/queues`,
  );

  const requeued = await EmailService.reconcileOnBoot();

  if (requeued > 0) {
    console.log(
      `Reconciliation: re-enqueued ${requeued} orphaned email(s) after restart.`,
    );
  }
});