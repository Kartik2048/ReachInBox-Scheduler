import { Queue, QueueOptions } from 'bullmq';
import { queueRedis } from '../config/redis';
import { BullMQEmailPayload } from '../types/contracts';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const emailQueueOptions: QueueOptions = {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600, // 1 hour
    },
    removeOnFail: {
      count: 200,
      age: 86400, // 24 hours
    },
  },
};

export const emailQueue = new Queue<BullMQEmailPayload>(EMAIL_QUEUE_NAME, emailQueueOptions);

emailQueue.on('error', (err) => {
  console.error('❌ BullMQ Queue Error:', err.message);
});

export default emailQueue;
