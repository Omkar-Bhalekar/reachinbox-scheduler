import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; name: string };
}

// Real Google identity comes from NextAuth on the frontend (a genuine OAuth
// flow with Google). The frontend forwards the verified profile on every
// API call via these headers; we upsert the corresponding backend User row
// here so the rest of the app just deals with a stable internal userId.
export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const googleId = req.header('x-user-google-id');
  const email = req.header('x-user-email');
  const name = req.header('x-user-name') || email;
  const avatar = req.header('x-user-avatar') || undefined;

  if (!googleId || !email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await prisma.user.upsert({
    where: { googleId },
    update: { email, name: name as string, avatar },
    create: { googleId, email, name: name as string, avatar },
  });

  req.user = { id: user.id, email: user.email, name: user.name };
  next();
}
