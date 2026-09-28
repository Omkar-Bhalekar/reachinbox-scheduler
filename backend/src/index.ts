import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config/env';
import { requireUser } from './middleware/auth';
import { emailQueue } from './queues/email.queue';

import './workers/email.worker';

import {
  scheduleEmail,
  listEmails,
  searchEmails,
  getEmail,
} from './controllers/email.controller';

import {
  whoami,
  register,
  login,
  slackConnect,
  slackCallback,
  slackDisconnect,
} from './controllers/auth.controller';

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

app.use(express.json());

/*
 * Bull Board
 */
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
  ],
  serverAdapter,
});

app.use(
  '/admin/queues',
  serverAdapter.getRouter(),
);

/*
 * Health check
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

/*
 * Authentication
 */
app.post('/api/auth/register', register);

app.post('/api/auth/login', login);

app.get(
  '/api/auth/whoami',
  requireUser,
  whoami,
);

app.post(
  '/api/auth/slack/connect',
  requireUser,
  slackConnect,
);

app.get(
  '/api/auth/slack/callback',
  slackCallback,
);

app.post(
  '/api/auth/slack/disconnect',
  requireUser,
  slackDisconnect,
);

/*
 * Email scheduling
 */
app.post(
  '/api/emails/schedule',
  requireUser,
  scheduleEmail,
);

/*
 * Email listing
 */
app.get(
  '/api/emails',
  requireUser,
  listEmails,
);

/*
 * Email search
 *
 * This route must come before /api/emails/:id
 * so "search" is not interpreted as an email ID.
 */
app.get(
  '/api/emails/search',
  requireUser,
  searchEmails,
);

/*
 * Single email
 */
app.get(
  '/api/emails/:id',
  requireUser,
  getEmail,
);

/*
 * Start server
 */
const startServer = () => {
  app.listen(config.port, () => {
    console.log(
      `Server running on port ${config.port}`,
    );

    console.log(
      `BullBoard UI available at http://localhost:${config.port}/admin/queues`,
    );
  });
};

startServer();