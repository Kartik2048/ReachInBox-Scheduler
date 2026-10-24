import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { createEtherealAccount } from './ethereal.service';
import { getRateLimitKey } from '../utils/redis-keys';
import { SenderDTO } from '../types/contracts';

export interface SenderWithStatsDTO extends SenderDTO {
  currentHourSentCount: number;
}

/**
 * List all senders belonging to the user with their current-hour rate limit usage from Redis.
 */
export async function listSendersForUser(userId: string): Promise<SenderWithStatsDTO[]> {
  const senders = await prisma.sender.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  const sendersWithStats: SenderWithStatsDTO[] = await Promise.all(
    senders.map(async (s) => {
      let currentHourSentCount = 0;
      try {
        const countStr = await redisClient.get(getRateLimitKey(s.id));
        currentHourSentCount = countStr ? parseInt(countStr, 10) : 0;
      } catch (err: any) {
        console.warn(`Could not read rate limit for sender ${s.id} from Redis:`, err.message);
      }

      return {
        id: s.id,
        userId: s.userId,
        name: s.name,
        email: s.email,
        smtpHost: s.smtpHost,
        smtpPort: s.smtpPort,
        smtpUser: s.smtpUser,
        maxEmailsPerHour: s.maxEmailsPerHour,
        createdAt: s.createdAt.toISOString(),
        currentHourSentCount,
      };
    })
  );

  return sendersWithStats;
}

/**
 * Create a new Ethereal sender account on demand for a user.
 */
export async function createNewSenderForUser(
  userId: string,
  data: { name?: string; maxEmailsPerHour?: number }
): Promise<SenderDTO> {
  const account = await createEtherealAccount(data.name || 'ReachInbox Sender');

  const sender = await prisma.sender.create({
    data: {
      userId,
      name: account.name,
      email: account.email,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpUser: account.smtpUser,
      smtpPass: account.smtpPass,
      maxEmailsPerHour: data.maxEmailsPerHour || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    },
  });

  return {
    id: sender.id,
    userId: sender.userId,
    name: sender.name,
    email: sender.email,
    smtpHost: sender.smtpHost,
    smtpPort: sender.smtpPort,
    smtpUser: sender.smtpUser,
    maxEmailsPerHour: sender.maxEmailsPerHour,
    createdAt: sender.createdAt.toISOString(),
  };
}
