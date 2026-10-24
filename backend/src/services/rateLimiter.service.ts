import { queueRedis } from '../config/redis';
import { getRateLimitKey, getLastSentKey, getUtcHourBucket } from '../utils/redis-keys';
import { RateLimitDecision } from '../types/contracts';

const RATE_LIMIT_LUA_SCRIPT = `
local hourlyKey = KEYS[1]
local lastSentKey = KEYS[2]
local overflowKey = KEYS[3]

local nowMs = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minDelayMs = tonumber(ARGV[3])
local nextHourStartMs = tonumber(ARGV[4])

-- 1. Read current hourly count
local currentCount = tonumber(redis.call('GET', hourlyKey) or '0')

-- 2. If hourly limit reached
if currentCount >= hourlyLimit then
    local overflowIndex = redis.call('INCR', overflowKey) - 1
    redis.call('EXPIRE', overflowKey, 7200)
    local targetTimestamp = nextHourStartMs + (overflowIndex * minDelayMs)
    return { 0, 'HOURLY_LIMIT_REACHED', tostring(targetTimestamp), currentCount }
end

-- 3. Read lastSentMs
local lastSentMs = tonumber(redis.call('GET', lastSentKey) or '0')

-- 4. Check minimum spacing violation
if lastSentMs > 0 and (nowMs - lastSentMs) < minDelayMs then
    local targetTimestamp = lastSentMs + minDelayMs
    if targetTimestamp >= nextHourStartMs and (currentCount + 1) > hourlyLimit then
        local overflowIndex = redis.call('INCR', overflowKey) - 1
        redis.call('EXPIRE', overflowKey, 7200)
        targetTimestamp = nextHourStartMs + (overflowIndex * minDelayMs)
        return { 0, 'HOURLY_LIMIT_REACHED', tostring(targetTimestamp), currentCount }
    end
    -- Atomically reserve the spaced slot for concurrent workers
    redis.call('SET', lastSentKey, tostring(targetTimestamp), 'PX', 3600000)
    return { 0, 'MIN_SPACING_DELAY', tostring(targetTimestamp), currentCount }
end

-- 5. Allowed
local newCount = redis.call('INCR', hourlyKey)
if newCount == 1 then
    redis.call('EXPIRE', hourlyKey, 7200)
end
redis.call('SET', lastSentKey, tostring(nowMs), 'PX', 3600000)
return { 1, 'ALLOWED', tostring(nowMs), newCount }
`;

export class RateLimiterService {
  /**
   * Atomically checks and reserves a send slot for a sender identity.
   */
  async checkAndConsumeSenderSlot(
    senderId: string,
    hourlyLimit: number,
    delayBetweenEmailsMs: number
  ): Promise<RateLimitDecision> {
    const now = new Date();
    const nowMs = now.getTime();

    // Calculate current UTC hour and next UTC hour boundaries
    const currentHourBucket = getUtcHourBucket(now);
    const currentHourStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0)
    );
    const nextHourStart = new Date(currentHourStart.getTime() + 3600000);
    const nextHourStartMs = nextHourStart.getTime();
    const nextHourBucket = getUtcHourBucket(nextHourStart);

    const hourlyKey = `rate_limit:${senderId}:${currentHourBucket}`;
    const lastSentKey = getLastSentKey(senderId);
    const overflowKey = `next_hour_overflow_seq:${senderId}:${nextHourBucket}`;

    const result = (await queueRedis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      3,
      hourlyKey,
      lastSentKey,
      overflowKey,
      nowMs.toString(),
      hourlyLimit.toString(),
      delayBetweenEmailsMs.toString(),
      nextHourStartMs.toString()
    )) as [number, string, string, number];

    const [allowedCode, reasonString, targetTimestampStr, count] = result;
    const targetTimestampMs = parseInt(targetTimestampStr, 10);

    if (allowedCode === 1) {
      return {
        allowed: true,
        waitMs: 0,
        nextAllowedTimestampMs: nowMs,
        currentHourCount: count,
      };
    }

    return {
      allowed: false,
      reason: reasonString as 'HOURLY_LIMIT_REACHED' | 'MIN_SPACING_DELAY',
      waitMs: Math.max(0, targetTimestampMs - nowMs),
      nextAllowedTimestampMs: targetTimestampMs,
      currentHourCount: count,
    };
  }

  /**
   * Get current hour count for a sender without consuming
   */
  async getCurrentHourSentCount(senderId: string): Promise<number> {
    const key = getRateLimitKey(senderId);
    const count = await queueRedis.get(key);
    return count ? parseInt(count, 10) : 0;
  }
}

export const rateLimiterService = new RateLimiterService();
export default rateLimiterService;
