import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { emailService } from '../services/email.service';
import { ScheduleBatchRequest } from '../types/contracts';

const scheduleBatchSchema = z.object({
  senderId: z.string().uuid('Invalid senderId format'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  startTime: z.string(),
  delayBetweenEmailsMs: z.number().int().min(100).default(2000),
  hourlyLimit: z.number().int().min(1).default(200),
});

export async function handleScheduleBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const parseResult = scheduleBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid scheduling payload',
      });
      return;
    }

    const result = await emailService.scheduleEmailBatch(
      req.user.id,
      parseResult.data as ScheduleBatchRequest
    );
    res.status(201).json({
      success: true,
      data: result,
      message: `Successfully scheduled ${result.totalScheduled} emails.`,
    });
  } catch (err: any) {
    console.error('❌ Error in handleScheduleBatch:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to schedule email batch',
    });
  }
}

export async function handleGetScheduledEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const data = await emailService.getScheduledEmails(req.user.id, search, page, limit);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch scheduled emails',
    });
  }
}

export async function handleGetSentEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const data = await emailService.getSentEmails(req.user.id, search, page, limit);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch sent emails',
    });
  }
}

export async function handleGetDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const stats = await emailService.getDashboardStats(req.user.id);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch dashboard stats',
    });
  }
}

export async function handleGetEmailById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const email = await emailService.getEmailById(req.user.id, req.params.id);
    if (!email) {
      res.status(404).json({ success: false, error: 'Email job not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: email,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch email job',
    });
  }
}
