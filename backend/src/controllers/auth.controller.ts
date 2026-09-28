import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { SlackService } from '../services/slack.service';
import { AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

/**
 * Create a JWT used by email/password authentication.
 *
 * The token contains only the internal user id.
 * The backend middleware uses that id to load the user.
 */
function createAuthToken(userId: string) {
  if (!config.authJwtSecret) {
    throw new Error('AUTH_JWT_SECRET is not configured');
  }

  return jwt.sign(
    { userId },
    config.authJwtSecret,
    { expiresIn: '7d' },
  );
}

/**
 * Register a new email/password user.
 */
export const register = async (
  req: Request,
  res: Response,
) => {
  try {
    const { email, password, name } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof name !== 'string'
    ) {
      return res.status(400).json({
        error: 'Name, email, and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail || !normalizedName || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });

    const token = createAuthToken(user.id);

    return res.status(201).json({
      token,
      user,
    });
  } catch (error: any) {
    console.error('Registration failed:', error);

    return res.status(500).json({
      error: 'Failed to create account',
    });
  }
};

/**
 * Login with email/password.
 */
export const login = async (
  req: Request,
  res: Response,
) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const token = createAuthToken(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    console.error('Login failed:', error);

    return res.status(500).json({
      error: 'Failed to login',
    });
  }
};

export const whoami = async (
  req: AuthedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Not authenticated',
    });
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
    return res.status(404).json({
      error: 'User not found',
    });
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
    return res.status(401).json({
      error: 'Not authenticated',
    });
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
    return res.status(400).send(
      'Missing OAuth code or state',
    );
  }

  try {
    const userId = await SlackService.consumeOAuthState(state);

    if (!userId) {
      return res.status(400).send(
        'Invalid or expired Slack OAuth state. Please start the connection again.',
      );
    }

    await SlackService.exchangeToken(
      code as string,
      userId,
    );

    return res.redirect(
      `${config.frontendUrl}/dashboard?slack=connected`,
    );
  } catch (error: any) {
    console.error(
      'Slack OAuth callback failed:',
      error,
    );

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
    return res.status(401).json({
      error: 'Not authenticated',
    });
  }

  try {
    await SlackService.disconnect(req.user.id);

    return res.json({
      ok: true,
      message: 'Slack disconnected successfully',
    });
  } catch (error: any) {
    console.error(
      'Slack disconnect failed:',
      error,
    );

    return res.status(500).json({
      error:
        error.message ||
        'Failed to disconnect Slack',
    });
  }
};