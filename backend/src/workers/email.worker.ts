import { Worker, Job, DelayedError } from 'bullmq';
import { workerRedis } from '../config/redis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { rateLimiterService } from '../services/rateLimiter.service';
import { mailerService } from '../services/mailer.service';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue';
import { BullMQEmailPayload } from '../types/contracts';

/**
 * Core processor for individual email jobs.
 * Enforces rate limiting, spacing, Ethereal dispatch, and non-destructive rescheduling.
 */
export async function processEmailJob(
  job: Job<BullMQEmailPayload>,
  token?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; skipped?: boolean; reason?: string }> {
  const { emailJobId } = job.data;

  // 1. Fetch EmailJob + Sender from Database (Idempotency Guard)
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { sender: true },
  });

  if (!emailJob) {
    console.warn(`⚠️ EmailJob ${emailJobId} not found in database. Skipping.`);
    return { success: true, skipped: true, reason: 'Job not found in database' };
  }

  if (emailJob.status === 'SENT') {
    console.log(`ℹ️ EmailJob ${emailJobId} is already marked as SENT. Idempotency guard triggered.`);
    return { success: true, skipped: true, reason: 'Job already sent' };
  }

  // 2. Check and consume rate-limit slot via atomic Redis Lua script
  const effectiveHourlyLimit = job.data.hourlyLimit || emailJob.hourlyLimit;
  const effectiveDelayMs = job.data.delayBetweenEmailsMs || emailJob.delayBetweenEmailsMs;

  const decision = await rateLimiterService.checkAndConsumeSenderSlot(
    emailJob.senderId,
    effectiveHourlyLimit,
    effectiveDelayMs
  );

  // 3. Rate Limit / Spacing Hit -> Reschedule Non-Destructively
  if (!decision.allowed) {
    console.log(
      `⏳ [RESCHEDULE] EmailJob ${emailJobId} (Sender: ${emailJob.sender.email}) hit ${decision.reason}. ` +
        `Next allowed slot at ${new Date(decision.nextAllowedTimestampMs).toISOString()} (wait: ${decision.waitMs}ms)`
    );

    // Update database status to RESCHEDULED
    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: 'RESCHEDULED',
        effectiveScheduledAt: new Date(decision.nextAllowedTimestampMs),
        rescheduledCount: { increment: 1 },
      },
    });

    // Move job to delayed state in BullMQ
    await job.moveToDelayed(decision.nextAllowedTimestampMs, token);

    // Throw DelayedError to notify BullMQ that the job was safely moved to delayed
    throw new DelayedError();
  }

  // 4. Allowed -> Transition to PROCESSING atomically
  const atomicUpdate = await prisma.emailJob.updateMany({
    where: {
      id: emailJob.id,
      status: { not: 'SENT' },
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
    },
  });

  if (atomicUpdate.count === 0) {
    console.log(`ℹ️ EmailJob ${emailJobId} state collision detected. Job already finalized.`);
    return { success: true, skipped: true, reason: 'Job collision, already finalized' };
  }

  // 5. Dispatch via Smart Ethereal Mailer
  try {
    const sendResult = await mailerService.sendEmail({
      jobId: emailJob.id,
      sender: emailJob.sender,
      recipientEmail: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
    });

    // Mark as SENT in PostgreSQL
    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        etherealMessageId: sendResult.messageId,
        etherealPreviewUrl: sendResult.previewUrl,
        errorMessage: null,
      },
    });

    console.log(
      `✅ [DISPATCHED] EmailJob ${emailJob.id} -> ${emailJob.recipientEmail} | Preview: ${sendResult.previewUrl}`
    );

    return {
      success: true,
      messageId: sendResult.messageId,
      previewUrl: sendResult.previewUrl,
    };
  } catch (err: any) {
    console.error(`❌ [DISPATCH_FAILED] EmailJob ${emailJob.id}:`, err.message);

    const isLastAttempt = (job.attemptsMade + 1) >= (job.opts.attempts || 3);

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        errorMessage: err.message,
        ...(isLastAttempt ? { status: 'FAILED' } : {}),
      },
    });

    throw err;
  }
}

/**
 * Initialize and start the BullMQ worker
 */
export function startEmailWorker(): Worker<BullMQEmailPayload> {
  const worker = new Worker<BullMQEmailPayload>(
    EMAIL_QUEUE_NAME,
    async (job, token) => {
      return processEmailJob(job, token);
    },
    {
      connection: workerRedis,
      concurrency: env.WORKER_CONCURRENCY,
      stalledInterval: 60000,
      lockDuration: 30000,
    }
  );

  worker.on('active', (job) => {
    console.log(`🔄 [WORKER] Processing job ${job.id} (EmailJob: ${job.data.emailJobId})`);
  });

  worker.on('completed', (job, returnvalue) => {
    console.log(`✨ [WORKER] Job ${job.id} completed.`, returnvalue);
  });

  worker.on('failed', (job, err) => {
    // DelayedError is expected when rescheduling; do not treat as an error
    if (err.name === 'DelayedError') {
      console.log(`⏸️ [WORKER] Job ${job?.id} cleanly deferred via moveToDelayed.`);
      return;
    }
    console.error(`💥 [WORKER] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ [WORKER_INTERNAL_ERROR]:', err.message);
  });

  console.log(`⚡ ReachInbox Email Worker started. Concurrency: ${env.WORKER_CONCURRENCY}`);
  return worker;
}

export const emailWorker = env.RUN_WORKER_IN_API ? startEmailWorker() : null;

// Allow running as a standalone OS process via `npm run worker:dev`
if (require.main === module && !env.RUN_WORKER_IN_API) {
  startEmailWorker();
}

export default emailWorker;
