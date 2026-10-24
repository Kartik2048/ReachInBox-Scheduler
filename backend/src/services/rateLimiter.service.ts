import { queueRedis } from '../config/redis';
import { getRateLimitKey, getLastSentKey, getReservedSlotKey, getUtcHourBucket } from '../utils/redis-keys';
import { RateLimitDecision } from '../types/contracts';

const RATE_LIMIT_LUA_SCRIPT = `
local hourlyKey = KEYS[1]
local lastSentKey = KEYS[2]
local overflowKey = KEYS[3]
local reservedKey = KEYS[4]

local nowMs = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minDelayMs = tonumber(ARGV[3])
local nextHourStartMs = tonumber(ARGV[4])

-- Jitter tolerance: 50ms margin for Node.js event-loop/timer drift
local JITTER_TOLERANCE_MS = 50

-- 1. Read current hourly count
local currentCount = tonumber(redis.call('GET', hourlyKey) or '0')

-- 2. If hourly limit reached
if currentCount >= hourlyLimit then
    local overflowIndex = redis.call('INCR', overflowKey) - 1
    redis.call('EXPIRE', overflowKey, 7200)
    local targetTimestamp = nextHourStartMs + (overflowIndex * minDelayMs)
    return { 0, 'HOURLY_LIMIT_REACHED', tostring(targetTimestamp), currentCount }
end

-- 3. Read lastSentMs (actual timestamp of last allowed dispatch)
local lastSentMs = tonumber(redis.call('GET', lastSentKey) or '0')

-- Defensive: If clock jumped or previous bug left a future timestamp in lastSentKey, clamp it
if lastSentMs > nowMs then
    lastSentMs = nowMs - minDelayMs
end

-- 4. Check minimum spacing violation against actual lastSentMs
if lastSentMs > 0 and (nowMs + JITTER_TOLERANCE_MS - lastSentMs) < minDelayMs then
    local reservedMs = tonumber(redis.call('GET', reservedKey) or '0')
    if reservedMs > (nowMs + 7200000) then
        reservedMs = nowMs
    end
    local baseTime = math.max(nowMs, math.max(lastSentMs, reservedMs))
    local targetTimestamp = baseTime + minDelayMs

    if targetTimestamp >= nextHourStartMs and (currentCount + 1) > hourlyLimit then
        local overflowIndex = redis.call('INCR', overflowKey) - 1
        redis.call('EXPIRE', overflowKey, 7200)
        targetTimestamp = nextHourStartMs + (overflowIndex * minDelayMs)
        return { 0, 'HOURLY_LIMIT_REACHED', tostring(targetTimestamp), currentCount }
    end

    redis.call('SET', reservedKey, tostring(targetTimestamp), 'PX', 3600000)
    return { 0, 'MIN_SPACING_DELAY', tostring(targetTimestamp), currentCount }
end

-- 5. Allowed to send!
local newCount = redis.call('INCR', hourlyKey)
if newCount == 1 then
    redis.call('EXPIRE', hourlyKey, 7200)
end
redis.call('SET', lastSentKey, tostring(nowMs), 'PX', 3600000)
redis.call('SET', reservedKey, tostring(nowMs), 'PX', 3600000)
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
    const reservedKey = getReservedSlotKey(senderId);

    const result = (await queueRedis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      4,
      hourlyKey,
      lastSentKey,
      overflowKey,
      reservedKey,
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

  /**
   * Returns timestamp of last sent email for a sender
   */
  async getLastSentTimestamp(senderId: string): Promise<number> {
    const key = getLastSentKey(senderId);
    const val = await queueRedis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Resets rate-limit and spacing state for a sender identity (cleans stale or corrupted state)
   */
  async resetSenderRateLimits(senderId: string): Promise<void> {
    const keys = await queueRedis.keys(`*${senderId}*`);
    if (keys.length > 0) {
      await queueRedis.del(...keys);
    }
  }
}

export const rateLimiterService = new RateLimiterService();
export default rateLimiterService;

