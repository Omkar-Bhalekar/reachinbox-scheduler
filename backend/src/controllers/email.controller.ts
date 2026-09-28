import { Response } from 'express';
import { EmailService } from '../services/email.service';
import { AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

export const scheduleEmail = async (
  req: AuthedRequest,
  res: Response,
) => {
  try {
    const {
      senderEmail,
      subject,
      body,
      recipients,
      startTime,
      delaySeconds,
      hourlyLimit,
    } = req.body;

    if (
      !senderEmail ||
      !subject ||
      !body ||
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !startTime
    ) {
      return res.status(400).json({
        error:
          'senderEmail, subject, body, recipients[] and startTime are required',
      });
    }

    const result = await EmailService.scheduleBatch({
      userId: req.user!.id,
      senderEmail,
      subject,
      body,
      recipients,
      startTime: new Date(startTime),
      delaySeconds: Number(delaySeconds) || 0,
      hourlyLimit: hourlyLimit
        ? Number(hourlyLimit)
        : undefined,
    });

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

export const listEmails = async (
  req: AuthedRequest,
  res: Response,
) => {
  try {
    const { status, page, limit } = req.query;

    const result = await EmailService.list(
      req.user!.id,
      status as string | undefined,
      page ? Number(page) : 1,
      limit ? Number(limit) : 25,
    );

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

export const searchEmails = async (
  req: AuthedRequest,
  res: Response,
) => {
  try {
    const q = (req.query.q as string) || '';

    if (!q) {
      return res.json({
        items: [],
      });
    }

    const items = await EmailService.search(
      req.user!.id,
      q,
    );

    return res.json({
      items,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

/**
 * Get one email belonging to the authenticated user.
 *
 * The userId condition is important here:
 * a user must never be able to request another
 * user's email by changing the URL id.
 */
export const getEmail = async (
  req: AuthedRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Email id is required',
      });
    }

    const email = await prisma.email.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!email) {
      return res.status(404).json({
        error: 'Email not found',
      });
    }

    return res.json({
      email,
    });
  } catch (error: any) {
    console.error('Get email failed:', error);

    return res.status(500).json({
      error: error.message || 'Failed to fetch email',
    });
  }
};