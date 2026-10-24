import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { queueRedis, workerRedis } from './config/redis';
import { emailQueue } from './queues/email.queue';
import { emailWorker } from './workers/email.worker';
import { emailService } from './services/email.service';

const server = app.listen(env.PORT, async () => {
  console.log(`
  🚀 ========================================================
  🚀 ReachInbox Email Scheduler API
  🚀 Port:        ${env.PORT}
  🚀 Environment: ${env.NODE_ENV}
  🚀 Healthcheck: http://localhost:${env.PORT}/api/health
  🚀 Worker Mode: ${env.RUN_WORKER_IN_API ? 'In-Process (Single-Dyno Free-Tier)' : 'External Worker Process'}
  🚀 ========================================================
  `);

  if (env.RUN_WORKER_IN_API) {
    console.log('⚡ BullMQ Worker started in co-located API mode.');
  }

  // Startup recovery reconciliation
  try {
    console.log('🔍 Running startup recovery reconciliation for orphaned jobs...');
    await emailService.reconcileOrphanedJobs();
  } catch (err: any) {
    console.error('⚠️ Startup reconciliation warning (Redis or DB may not be ready yet):', err.message);
  }
});

// Graceful Shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Closing ReachInbox API server gracefully...`);
  server.close(async () => {
    try {
      if (emailWorker) {
        await emailWorker.close();
      }
      await emailQueue.close();
      await prisma.$disconnect();
      await queueRedis.quit();
      await workerRedis.quit();
      console.log('✅ BullMQ Worker, Queue, PostgreSQL, and Redis connections closed successfully.');
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Error during shutdown cleanup:', err.message);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default server;
