import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface SendEmailParams {
  jobId: string;
  sender: {
    id: string;
    name: string;
    email: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  };
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string;
  fallbackUsed: boolean;
  rawMime?: string;
}

// In-memory cache of rendered email previews for cloud port-blocking fallback
export const renderedEmailPreviews = new Map<string, { subject: string; body: string; to: string; from: string; date: string; rawMime?: string }>();

export class MailerService {
  private transporters = new Map<string, Transporter>();

  /**
   * Retrieves or creates a cached Nodemailer transporter for a given sender identity
   */
  private getTransporter(sender: SendEmailParams['sender']): Transporter {
    if (!this.transporters.has(sender.id)) {
      const transporter = nodemailer.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPass,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
      });

      this.transporters.set(sender.id, transporter);
    }

    return this.transporters.get(sender.id)!;
  }

  /**
   * Dispatches email via Ethereal SMTP with automatic cloud port-block fallback
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { jobId, sender, recipientEmail, subject, body } = params;

    const mailOptions = {
      from: `"${sender.name}" <${sender.email}>`,
      to: recipientEmail,
      subject,
      text: body,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
          <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #7c3aed; margin: 0;">ReachInbox Campaign Dispatch</h2>
            <p style="color: #666; font-size: 12px; margin: 4px 0 0 0;">Recipient: ${recipientEmail} | Job ID: ${jobId}</p>
          </div>
          <div style="font-size: 15px; white-space: pre-wrap;">${body}</div>
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #888;">
            Sent by ReachInbox Email Job Scheduler &bull; Sender: ${sender.email}
          </div>
        </div>
      `,
    };

    try {
      const transporter = this.getTransporter(sender);
      const info = await transporter.sendMail(mailOptions);
      const etherealUrl = nodemailer.getTestMessageUrl(info);

      return {
        messageId: info.messageId,
        previewUrl: etherealUrl || `https://ethereal.email/messages`,
        fallbackUsed: false,
      };
    } catch (err: any) {
      const isPortBlockError =
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ESOCKET' ||
        err.message?.includes('timeout') ||
        err.message?.includes('greeting');

      if (env.SMTP_FALLBACK_ON_PORT_BLOCK && isPortBlockError) {
        console.warn(`⚠️ Outbound SMTP port blocked on host (${err.code || err.message}). Triggering smart Ethereal stream fallback.`);

        // Use stream transport to generate realistic RFC822 MIME
        const streamTransport = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true,
        });

        const streamInfo: any = await streamTransport.sendMail(mailOptions);
        const rawMime = streamInfo.message?.toString('utf-8') || '';

        // Store rendered email preview for web browser evaluation
        renderedEmailPreviews.set(jobId, {
          subject,
          body: mailOptions.html,
          to: recipientEmail,
          from: `${sender.name} <${sender.email}>`,
          date: new Date().toISOString(),
          rawMime,
        });

        const deterministicMessageId = `<fallback-${jobId}@reachinbox.local>`;
        const fallbackPreviewUrl = `/api/emails/${jobId}/preview`;

        return {
          messageId: deterministicMessageId,
          previewUrl: fallbackPreviewUrl,
          fallbackUsed: true,
          rawMime,
        };
      }

      // If not handled by fallback, rethrow error to trigger BullMQ retry logic
      throw err;
    }
  }
}

export const mailerService = new MailerService();
export default mailerService;
