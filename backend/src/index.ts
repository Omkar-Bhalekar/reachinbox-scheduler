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
import { scheduleEmail, listEmails, searchEmails } from './controllers/email.controller';
import { whoami, slackConnect, slackCallback } from './controllers/auth.controller';
import { EmailService } from './services/email.service';

const app = express();
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Live BullMQ dashboard. Left open (no auth) for local/demo use - a real
// deployment would put this behind proper session auth, not the
// header-based scheme below (which only works for XHR/fetch calls, not
// plain browser navigation to this URL).
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
app.use('/admin/queues', serverAdapter.getRouter());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/auth/whoami', requireUser, whoami);
app.get('/api/auth/slack/connect', slackConnect); // uid passed as query param, see controller
app.get('/api/auth/slack/callback', slackCallback); // Slack redirects here directly

app.post('/api/emails/schedule', requireUser, scheduleEmail);
app.get('/api/emails', requireUser, listEmails);
app.get('/api/emails/search', requireUser, searchEmails);

app.listen(config.port, async () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`BullBoard UI available at http://localhost:${config.port}/admin/queues`);

  const requeued = await EmailService.reconcileOnBoot();
  if (requeued > 0) {
    console.log(`Reconciliation: re-enqueued ${requeued} orphaned email(s) after restart.`);
  }
});
