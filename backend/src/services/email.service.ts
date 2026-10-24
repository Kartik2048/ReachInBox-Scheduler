import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { emailQueue } from '../queues/email.queue';
import {
  ScheduleBatchRequest,
  ScheduleBatchResponse,
  EmailJobDTO,
  DashboardStatsDTO,
  BullMQEmailPayload,
} from '../types/contracts';

// Basic email regex validator
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailService {
  /**
   * Schedules a bulk email batch with high throughput chunked persistence and smart staggering.
   */
  async scheduleEmailBatch(
    userId: string,
    payload: ScheduleBatchRequest
  ): Promise<ScheduleBatchResponse> {
    const {
      senderId,
      subject,
      body,
      recipients: rawRecipients,
      startTime: rawStartTime,
      delayBetweenEmailsMs: rawDelay,
      hourlyLimit: rawLimit,
    } = payload;

    // 1. Validate & sanitize recipients
    const uniqueRecipients = Array.from(
      new Set(
        rawRecipients
          .map((r) => r.trim().toLowerCase())
          .filter((r) => EMAIL_REGEX.test(r))
      )
    );

    if (uniqueRecipients.length === 0) {
      throw new Error('No valid email recipients provided.');
    }

    // 2. Verify sender ownership
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender identity not found or does not belong to this account.');
    }

    const delayBetweenEmailsMs = Math.max(100, rawDelay || sender.maxEmailsPerHour ? Math.floor(3600000 / sender.maxEmailsPerHour) : 2000);
    const hourlyLimit = Math.max(1, rawLimit || sender.maxEmailsPerHour || 200);

    const now = Date.now();
    const requestedStartTime = new Date(rawStartTime).getTime();
    let slotTime = Math.max(now, isNaN(requestedStartTime) ? now : requestedStartTime);

    // 3. Create EmailBatch in PostgreSQL
    const emailBatch = await prisma.emailBatch.create({
      data: {
        userId,
        senderId,
        subject,
        body,
        totalEmails: uniqueRecipients.length,
        startTime: new Date(slotTime),
        delayBetweenEmailsMs,
        hourlyLimit,
      },
    });

    // 4. Pre-calculate staggered timestamps for each recipient
    const jobsData: {
      id: string;
      batchId: string;
      userId: string;
      senderId: string;
      recipientEmail: string;
      subject: string;
      body: string;
      scheduledAt: Date;
      effectiveScheduledAt: Date;
      bullmqJobId: string;
      delayBetweenEmailsMs: number;
      hourlyLimit: number;
    }[] = [];

    let currentHourStart = new Date(
      Date.UTC(
        new Date(slotTime).getUTCFullYear(),
        new Date(slotTime).getUTCMonth(),
        new Date(slotTime).getUTCDate(),
        new Date(slotTime).getUTCHours(),
        0, 0, 0
      )
    ).getTime();
    let nextHourStart = currentHourStart + 3600000;
    let countInCurrentHour = 0;

    for (const recipient of uniqueRecipients) {
      // Check if we reached the hourly quota or crossed into the next hour window
      if (countInCurrentHour >= hourlyLimit || slotTime >= nextHourStart) {
        slotTime = Math.max(slotTime, nextHourStart);
        currentHourStart = new Date(
          Date.UTC(
            new Date(slotTime).getUTCFullYear(),
            new Date(slotTime).getUTCMonth(),
            new Date(slotTime).getUTCDate(),
            new Date(slotTime).getUTCHours(),
            0, 0, 0
          )
        ).getTime();
        nextHourStart = currentHourStart + 3600000;
        countInCurrentHour = 0;
      }

      const jobId = crypto.randomUUID();
      const scheduledDate = new Date(slotTime);

      jobsData.push({
        id: jobId,
        batchId: emailBatch.id,
        userId,
        senderId,
        recipientEmail: recipient,
        subject,
        body,
        scheduledAt: scheduledDate,
        effectiveScheduledAt: scheduledDate,
        bullmqJobId: `email-${jobId}`,
        delayBetweenEmailsMs,
        hourlyLimit,
      });

      countInCurrentHour++;
      slotTime += delayBetweenEmailsMs;
    }

    const firstScheduledAt = jobsData[0].effectiveScheduledAt.toISOString();
    const lastScheduledAt = jobsData[jobsData.length - 1].effectiveScheduledAt.toISOString();

    // 5. High-Throughput Chunked Persistence & BullMQ Enqueueing (Chunks of 500)
    const CHUNK_SIZE = 500;
    for (let i = 0; i < jobsData.length; i += CHUNK_SIZE) {
      const chunk = jobsData.slice(i, i + CHUNK_SIZE);

      // Bulk insert into PostgreSQL
      await prisma.emailJob.createMany({
        data: chunk,
      });

      // Bulk enqueue into BullMQ
      const bullmqJobs = chunk.map((job) => {
        const delayMs = Math.max(0, job.effectiveScheduledAt.getTime() - Date.now());
        const payload: BullMQEmailPayload = {
          emailJobId: job.id,
          senderId: job.senderId,
          userId: job.userId,
          delayBetweenEmailsMs: job.delayBetweenEmailsMs,
          hourlyLimit: job.hourlyLimit,
        };

        return {
          name: 'send-email',
          data: payload,
          opts: {
            jobId: job.bullmqJobId,
            delay: delayMs,
          },
        };
      });

      await emailQueue.addBulk(bullmqJobs);
    }

    return {
      batchId: emailBatch.id,
      totalScheduled: uniqueRecipients.length,
      firstScheduledAt,
      lastScheduledAt,
    };
  }

  /**
   * Retrieves all scheduled, rescheduled, and processing email jobs for a user.
   */
  async getScheduledEmails(
    userId: string,
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ jobs: EmailJobDTO[]; total: number; page: number; totalPages: number }> {
    const where: any = {
      userId,
      status: {
        in: ['SCHEDULED', 'RESCHEDULED', 'PROCESSING'],
      },
    };

    if (search && search.trim()) {
      where.OR = [
        { recipientEmail: { contains: search.trim(), mode: 'insensitive' } },
        { subject: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        include: { sender: true },
        orderBy: { effectiveScheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const jobs: EmailJobDTO[] = records.map((r) => ({
      id: r.id,
      batchId: r.batchId,
      userId: r.userId,
      senderId: r.senderId,
      sender: {
        id: r.sender.id,
        userId: r.sender.userId,
        name: r.sender.name,
        email: r.sender.email,
        smtpHost: r.sender.smtpHost,
        smtpPort: r.sender.smtpPort,
        smtpUser: r.sender.smtpUser,
        maxEmailsPerHour: r.sender.maxEmailsPerHour,
        createdAt: r.sender.createdAt.toISOString(),
      },
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      body: r.body,
      status: r.status as any,
      scheduledAt: r.scheduledAt.toISOString(),
      effectiveScheduledAt: r.effectiveScheduledAt.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      bullmqJobId: r.bullmqJobId,
      etherealMessageId: r.etherealMessageId,
      etherealPreviewUrl: r.etherealPreviewUrl,
      rescheduledCount: r.rescheduledCount,
      attempts: r.attempts,
      errorMessage: r.errorMessage,
      delayBetweenEmailsMs: r.delayBetweenEmailsMs,
      hourlyLimit: r.hourlyLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves all dispatched and failed email jobs for a user.
   */
  async getSentEmails(
    userId: string,
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ jobs: EmailJobDTO[]; total: number; page: number; totalPages: number }> {
    const where: any = {
      userId,
      status: {
        in: ['SENT', 'FAILED'],
      },
    };

    if (search && search.trim()) {
      where.OR = [
        { recipientEmail: { contains: search.trim(), mode: 'insensitive' } },
        { subject: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        include: { sender: true },
        orderBy: [{ sentAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const jobs: EmailJobDTO[] = records.map((r) => ({
      id: r.id,
      batchId: r.batchId,
      userId: r.userId,
      senderId: r.senderId,
      sender: {
        id: r.sender.id,
        userId: r.sender.userId,
        name: r.sender.name,
        email: r.sender.email,
        smtpHost: r.sender.smtpHost,
        smtpPort: r.sender.smtpPort,
        smtpUser: r.sender.smtpUser,
        maxEmailsPerHour: r.sender.maxEmailsPerHour,
        createdAt: r.sender.createdAt.toISOString(),
      },
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      body: r.body,
      status: r.status as any,
      scheduledAt: r.scheduledAt.toISOString(),
      effectiveScheduledAt: r.effectiveScheduledAt.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      bullmqJobId: r.bullmqJobId,
      etherealMessageId: r.etherealMessageId,
      etherealPreviewUrl: r.etherealPreviewUrl,
      rescheduledCount: r.rescheduledCount,
      attempts: r.attempts,
      errorMessage: r.errorMessage,
      delayBetweenEmailsMs: r.delayBetweenEmailsMs,
      hourlyLimit: r.hourlyLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves aggregate counts of all job statuses for a user.
   */
  async getDashboardStats(userId: string): Promise<DashboardStatsDTO> {
    const statusGroups = await prisma.emailJob.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const stats: DashboardStatsDTO = {
      scheduledCount: 0,
      rescheduledCount: 0,
      sentCount: 0,
      failedCount: 0,
    };

    for (const group of statusGroups) {
      if (group.status === 'SCHEDULED' || group.status === 'PROCESSING') {
        stats.scheduledCount += group._count;
      } else if (group.status === 'RESCHEDULED') {
        stats.rescheduledCount += group._count;
      } else if (group.status === 'SENT') {
        stats.sentCount += group._count;
      } else if (group.status === 'FAILED') {
        stats.failedCount += group._count;
      }
    }

    return stats;
  }

  /**
   * Fetches an individual email job by ID.
   */
  async getEmailById(userId: string, id: string): Promise<EmailJobDTO | null> {
    const r = await prisma.emailJob.findFirst({
      where: { id, userId },
      include: { sender: true },
    });

    if (!r) return null;

    return {
      id: r.id,
      batchId: r.batchId,
      userId: r.userId,
      senderId: r.senderId,
      sender: {
        id: r.sender.id,
        userId: r.sender.userId,
        name: r.sender.name,
        email: r.sender.email,
        smtpHost: r.sender.smtpHost,
        smtpPort: r.sender.smtpPort,
        smtpUser: r.sender.smtpUser,
        maxEmailsPerHour: r.sender.maxEmailsPerHour,
        createdAt: r.sender.createdAt.toISOString(),
      },
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      body: r.body,
      status: r.status as any,
      scheduledAt: r.scheduledAt.toISOString(),
      effectiveScheduledAt: r.effectiveScheduledAt.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      bullmqJobId: r.bullmqJobId,
      etherealMessageId: r.etherealMessageId,
      etherealPreviewUrl: r.etherealPreviewUrl,
      rescheduledCount: r.rescheduledCount,
      attempts: r.attempts,
      errorMessage: r.errorMessage,
      delayBetweenEmailsMs: r.delayBetweenEmailsMs,
      hourlyLimit: r.hourlyLimit,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  /**
   * Startup reconciliation: finds any pending jobs in PostgreSQL missing from BullMQ and re-enqueues them.
   */
  async reconcileOrphanedJobs(): Promise<number> {
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'RESCHEDULED'],
        },
      },
    });

    if (pendingJobs.length === 0) {
      console.log('✅ [RECONCILIATION] No orphaned jobs found. Queue is in sync.');
      return 0;
    }

    let reEnqueuedCount = 0;
    const now = Date.now();

    for (const job of pendingJobs) {
      const existingQueueJob = await emailQueue.getJob(job.bullmqJobId);
      if (!existingQueueJob) {
        const delayMs = Math.max(0, job.effectiveScheduledAt.getTime() - now);
        const payload: BullMQEmailPayload = {
          emailJobId: job.id,
          senderId: job.senderId,
          userId: job.userId,
          delayBetweenEmailsMs: job.delayBetweenEmailsMs,
          hourlyLimit: job.hourlyLimit,
        };

        await emailQueue.add('send-email', payload, {
          jobId: job.bullmqJobId,
          delay: delayMs,
        });

        reEnqueuedCount++;
      }
    }

    if (reEnqueuedCount > 0) {
      console.log(`♻️ [RECONCILIATION] Successfully recovered and re-enqueued ${reEnqueuedCount} orphaned jobs.`);
    } else {
      console.log('✅ [RECONCILIATION] All pending jobs are active in BullMQ.');
    }

    return reEnqueuedCount;
  }
}

export const emailService = new EmailService();
export default emailService;
