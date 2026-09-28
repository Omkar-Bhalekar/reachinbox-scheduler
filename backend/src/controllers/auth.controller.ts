import { Response } from 'express';
import { SlackService } from '../services/slack.service';
import { AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

export const whoami = async (req: AuthedRequest, res: Response) => {
  return res.json({ user: req.user });
};

// Plain browser navigation (an <a href>) can't carry our custom auth
// headers, so this takes the already-known backend userId as a query param
// (the frontend fetches it once via the authenticated /whoami call) rather
// than requiring the header-based middleware.
export const slackConnect = async (req: AuthedRequest, res: Response) => {
  const uid = req.query.uid as string;
  if (!uid) return res.status(400).send('Missing uid');

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) return res.status(404).send('User not found');

  return res.redirect(SlackService.getAuthorizeUrl(user.id));
};

export const slackCallback = async (req: AuthedRequest, res: Response) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) {
    return res.status(400).send('Missing code or state (userId)');
  }
  try {
    await SlackService.exchangeToken(code as string, userId as string);
    return res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (error: any) {
    return res.status(500).send(`Error authorizing Slack: ${error.message}`);
  }
};
