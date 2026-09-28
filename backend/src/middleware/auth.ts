import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../lib/prisma';
import { config } from '../config/env';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

type AuthTokenPayload = {
  userId: string;
};

/**
 * Authenticate requests using either:
 *
 * 1. Backend JWT from email/password login
 * 2. Existing Google identity headers from NextAuth
 */
export async function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    /*
     * ---------------------------------------------------------
     * Method 1: Email/password JWT
     * ---------------------------------------------------------
     */
    const authorization = req.header('authorization');

    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();

      if (!config.authJwtSecret) {
        console.error('AUTH_JWT_SECRET is not configured');
        return res.status(500).json({
          error: 'Authentication is not configured',
        });
      }

      try {
        const payload = jwt.verify(
          token,
          config.authJwtSecret,
        ) as AuthTokenPayload;

        if (!payload.userId) {
          return res.status(401).json({
            error: 'Invalid authentication token',
          });
        }

        const user = await prisma.user.findUnique({
          where: {
            id: payload.userId,
          },
        });

        if (!user) {
          return res.status(401).json({
            error: 'User not found',
          });
        }

        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
        };

        return next();
      } catch {
        return res.status(401).json({
          error: 'Invalid or expired authentication token',
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * Method 2: Existing Google / NextAuth authentication
     * ---------------------------------------------------------
     */
    const googleId = req.header('x-user-google-id');
    const email = req.header('x-user-email');
    const name = req.header('x-user-name') || email;
    const avatar = req.header('x-user-avatar') || undefined;

    if (!googleId || !email) {
      return res.status(401).json({
        error: 'Not authenticated',
      });
    }

    const user = await prisma.user.upsert({
      where: {
        googleId,
      },
      update: {
        email,
        name: name as string,
        avatar,
      },
      create: {
        googleId,
        email,
        name: name as string,
        avatar,
      },
    });

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    return next();
  } catch (error) {
    console.error('Authentication middleware failed:', error);

    return res.status(500).json({
      error: 'Authentication failed',
    });
  }
}