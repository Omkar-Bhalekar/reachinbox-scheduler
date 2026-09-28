import { Response } from 'express';
import { SlackService } from '../services/slack.service';
import { AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

export const whoami = async (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      slackTeamName: true,
      slackWebhookUrl: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      slackConnected: Boolean(user.slackWebhookUrl),
      slackTeamName: user.slackTeamName,
    },
  });
};

export const slackConnect = async (
  req: AuthedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!config.slack.clientId || !config.slack.clientSecret) {
    return res.status(503).json({
      error: 'Slack OAuth is not configured on the backend',
    });
  }

  const state = await SlackService.createOAuthState(req.user.id);
  const authorizeUrl = SlackService.getAuthorizeUrl(state);

  return res.json({ authorizeUrl });
};

export const slackCallback = async (
  req: AuthedRequest,
  res: Response,
) => {
  const { code, state } = req.query;

  if (!code || !state || typeof state !== 'string') {
    return res.status(400).send('Missing OAuth code or state');
  }

  try {
    const userId = await SlackService.consumeOAuthState(state);

    if (!userId) {
      return res.status(400).send(
        'Invalid or expired Slack OAuth state. Please start the connection again.',
      );
    }

    await SlackService.exchangeToken(code as string, userId);

    return res.redirect(
      `${config.frontendUrl}/dashboard?slack=connected`,
    );
  } catch (error: any) {
    console.error('Slack OAuth callback failed:', error);

    return res.redirect(
      `${config.frontendUrl}/dashboard?slack=error`,
    );
  }
};

export const slackDisconnect = async (
  req: AuthedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    await SlackService.disconnect(req.user.id);

    return res.json({
      ok: true,
      message: 'Slack disconnected successfully',
    });
  } catch (error: any) {
    console.error('Slack disconnect failed:', error);

    return res.status(500).json({
      error: error.message || 'Failed to disconnect Slack',
    });
  }
};