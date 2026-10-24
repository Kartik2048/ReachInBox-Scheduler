import { Request, Response } from 'express';
import { z } from 'zod';
import {
  authenticateGoogleUser,
  authenticateDemoUser,
  verifyGoogleCredential,
  ensureDefaultSenders,
} from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export async function handleGoogleLogin(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = googleAuthSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid request body',
      });
      return;
    }

    const payload = await verifyGoogleCredential(parseResult.data.credential);
    const authResult = await authenticateGoogleUser(payload);

    res.status(200).json({
      success: true,
      data: authResult,
    });
  } catch (err: any) {
    console.error('❌ Google login error:', err.message);
    res.status(401).json({
      success: false,
      error: err.message || 'Google authentication failed.',
    });
  }
}

export async function handleDemoLogin(req: Request, res: Response): Promise<void> {
  try {
    const authResult = await authenticateDemoUser();
    res.status(200).json({
      success: true,
      data: authResult,
    });
  } catch (err: any) {
    console.error('❌ Demo login error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Demo authentication failed.',
    });
  }
}

export async function handleGetMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const senders = await ensureDefaultSenders(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        senders,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch user profile.',
    });
  }
}
