import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

const isTls = env.REDIS_URL.startsWith('rediss://');

const baseRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  ...(isTls
    ? {
        tls: {
          rejectUnauthorized: false,
        },
      }
    : {}),
};

// Singleton Redis connection for BullMQ Queue definitions and application Lua scripts
export const queueRedis = new Redis(env.REDIS_URL, {
  ...baseRedisOptions,
  connectionName: 'reachinbox-queue-client',
});

// Singleton Redis connection for BullMQ Worker engine
export const workerRedis = new Redis(env.REDIS_URL, {
  ...baseRedisOptions,
  connectionName: 'reachinbox-worker-client',
});

queueRedis.on('connect', () => {
  console.log('✅ Connected to Queue Redis successfully');
});

queueRedis.on('error', (err) => {
  console.error('❌ Queue Redis connection error:', err.message);
});

workerRedis.on('connect', () => {
  console.log('✅ Connected to Worker Redis successfully');
});

workerRedis.on('error', (err) => {
  console.error('❌ Worker Redis connection error:', err.message);
});

// Backward-compatible aliases
export const redisClient = queueRedis;
export const redisSubscriber = workerRedis;

export default queueRedis;
