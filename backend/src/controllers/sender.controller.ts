import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { listSendersForUser, createNewSenderForUser } from '../services/sender.service';

const createSenderSchema = z.object({
  name: z.string().min(1).optional(),
  maxEmailsPerHour: z.number().int().positive().optional(),
});

export async function handleGetSenders(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const senders = await listSendersForUser(req.user.id);
    res.status(200).json({
      success: true,
      data: senders,
    });
  } catch (err: any) {
    console.error('❌ Error listing senders:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to list senders',
    });
  }
}

export async function handleCreateSender(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const parseResult = createSenderSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid sender parameters',
      });
      return;
    }

    const newSender = await createNewSenderForUser(req.user.id, parseResult.data);
    res.status(201).json({
      success: true,
      data: newSender,
    });
  } catch (err: any) {
    console.error('❌ Error creating sender:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to create sender',
    });
  }
}
