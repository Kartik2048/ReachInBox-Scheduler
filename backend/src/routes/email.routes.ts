import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { renderedEmailPreviews } from '../services/mailer.service';
import { requireAuth } from '../middleware/auth.middleware';
import {
  handleScheduleBatch,
  handleGetScheduledEmails,
  handleGetSentEmails,
  handleGetDashboardStats,
  handleGetEmailById,
} from '../controllers/email.controller';

export const emailRouter = Router();

// ==========================================
// Authenticated API Endpoints
// ==========================================
emailRouter.post('/schedule', requireAuth, handleScheduleBatch);
emailRouter.get('/scheduled', requireAuth, handleGetScheduledEmails);
emailRouter.get('/sent', requireAuth, handleGetSentEmails);
emailRouter.get('/stats', requireAuth, handleGetDashboardStats);
emailRouter.get('/:id', requireAuth, handleGetEmailById);

// ==========================================
// Public Preview Endpoint for Ethereal / Cloud Fallback
// ==========================================
emailRouter.get('/:id/preview', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // 1. Check in-memory preview cache
  const cached = renderedEmailPreviews.get(id);
  if (cached) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(cached.body);
    return;
  }

  // 2. Fallback to database record
  try {
    const job = await prisma.emailJob.findUnique({
      where: { id },
      include: { sender: true },
    });

    if (!job) {
      res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px; color: #888;">
          <h2>Email Job Not Found</h2>
          <p>ID: ${id}</p>
        </div>
      `);
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${job.subject} - ReachInbox Preview</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0F19; color: #F9FAFB; padding: 24px 16px; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .card { width: 100%; max-width: 680px; background: #111827; border: 1px solid #374151; border-radius: 14px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #1F2937; padding-bottom: 16px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
            .badge-sent { background: #064E3B; color: #34D399; }
            .badge-rescheduled { background: #78350F; color: #FBBF24; }
            .badge-scheduled { background: #1E3A8A; color: #60A5FA; }
            .badge-processing { background: #4C1D95; color: #A78BFA; }
            .badge-failed { background: #881337; color: #FB7185; }
            .meta { font-size: 13px; color: #9CA3AF; line-height: 1.8; margin-bottom: 24px; background: #182234; padding: 14px 18px; border-radius: 8px; border: 1px solid #233044; }
            .meta strong { color: #D1D5DB; }
            .content { color: #E5E7EB; line-height: 1.7; font-size: 15px; white-space: pre-wrap; background: #0B0F19; padding: 20px; border-radius: 8px; border-left: 4px solid #7C3AED; }
            .footer { margin-top: 24px; font-size: 12px; color: #6B7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 style="margin: 0; color: #C4B5FD; font-size: 20px;">${job.subject}</h2>
              <span class="badge badge-${job.status.toLowerCase()}">${job.status}</span>
            </div>
            <div class="meta">
              <div><strong>From:</strong> ${job.sender.name} &lt;${job.sender.email}&gt;</div>
              <div><strong>To:</strong> ${job.recipientEmail}</div>
              <div><strong>Target Schedule:</strong> ${new Date(job.scheduledAt).toLocaleString()}</div>
              ${job.sentAt ? `<div><strong>Dispatched At:</strong> ${new Date(job.sentAt).toLocaleString()}</div>` : ''}
              ${job.rescheduledCount > 0 ? `<div><strong>Rescheduled Count:</strong> ${job.rescheduledCount}</div>` : ''}
              ${job.etherealMessageId ? `<div><strong>Message-ID:</strong> ${job.etherealMessageId}</div>` : ''}
            </div>
            <div class="content">${job.body}</div>
            <div class="footer">
              ReachInbox Email Job Scheduler &bull; Job ID: ${job.id}
            </div>
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err: any) {
    res.status(500).send(`<h3>Error generating email preview: ${err.message}</h3>`);
  }
});

export default emailRouter;
