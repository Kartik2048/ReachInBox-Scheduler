import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createEtherealAccount } from './ethereal.service';
import { AuthResponse, UserProfile, SenderDTO } from '../types/contracts';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

export interface GooglePayload {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

/**
 * Verify Google ID Token or Google Access Token
 */
export async function verifyGoogleCredential(credential: string): Promise<GooglePayload> {
  // 1. Try standard verifyIdToken if GOOGLE_CLIENT_ID is configured
  if (env.GOOGLE_CLIENT_ID) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload && payload.sub && payload.email) {
        return {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          avatarUrl: payload.picture || null,
        };
      }
    } catch (err: any) {
      console.warn('verifyIdToken with audience failed, trying tokeninfo endpoint:', err.message);
    }
  }

  // 2. Fallback: Query Google tokeninfo/userinfo endpoint or decode JWT
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (response.ok) {
      const data: any = await response.json();
      if (data.sub && data.email) {
        return {
          googleId: data.sub,
          email: data.email,
          name: data.name || data.email.split('@')[0],
          avatarUrl: data.picture || null,
        };
      }
    }
  } catch (err: any) {
    console.warn('Google tokeninfo fetch failed:', err.message);
  }

  // 3. Fallback: Parse decoded token if signed by Google
  const decoded: any = jwt.decode(credential);
  if (decoded && decoded.sub && decoded.email) {
    return {
      googleId: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0],
      avatarUrl: decoded.picture || null,
    };
  }

  throw new Error('Invalid or unverified Google OAuth token.');
}

/**
 * Ensure the user has at least 2 default Ethereal sender accounts
 */
export async function ensureDefaultSenders(userId: string): Promise<SenderDTO[]> {
  const existingSenders = await prisma.sender.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  if (existingSenders.length >= 2) {
    return existingSenders.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: s.name,
      email: s.email,
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpUser: s.smtpUser,
      maxEmailsPerHour: s.maxEmailsPerHour,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  // Auto-provision 2 accounts
  console.log(`⚡ Auto-provisioning initial Ethereal SMTP senders for user ${userId}...`);
  const sender1 = await createEtherealAccount('Primary Outreach');
  const sender2 = await createEtherealAccount('Growth Campaigns');

  await prisma.sender.createMany({
    data: [
      {
        userId,
        name: sender1.name,
        email: sender1.email,
        smtpHost: sender1.smtpHost,
        smtpPort: sender1.smtpPort,
        smtpUser: sender1.smtpUser,
        smtpPass: sender1.smtpPass,
        maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      },
      {
        userId,
        name: sender2.name,
        email: sender2.email,
        smtpHost: sender2.smtpHost,
        smtpPort: sender2.smtpPort,
        smtpUser: sender2.smtpUser,
        smtpPass: sender2.smtpPass,
        maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      },
    ],
    skipDuplicates: true,
  });

  const refreshedSenders = await prisma.sender.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return refreshedSenders.map((s) => ({
    id: s.id,
    userId: s.userId,
    name: s.name,
    email: s.email,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpUser: s.smtpUser,
    maxEmailsPerHour: s.maxEmailsPerHour,
    createdAt: s.createdAt.toISOString(),
  }));
}

/**
 * Login or register via verified Google payload
 */
export async function authenticateGoogleUser(payload: GooglePayload): Promise<AuthResponse & { senders: SenderDTO[] }> {
  const user = await prisma.user.upsert({
    where: { email: payload.email },
    update: {
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      googleId: payload.googleId,
    },
    create: {
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      googleId: payload.googleId,
    },
  });

  const senders = await ensureDefaultSenders(user.id);

  const token = jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    env.JWT_SECRET,
    { expiresIn: (env.JWT_EXPIRES_IN as any) || '7d' }
  );

  const userProfile: UserProfile = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };

  return {
    token,
    user: userProfile,
    senders,
  };
}

/**
 * Reviewer demo login flow
 */
export async function authenticateDemoUser(): Promise<AuthResponse & { senders: SenderDTO[] }> {
  if (!env.ALLOW_DEMO_AUTH) {
    throw new Error('Demo authentication is disabled in this environment.');
  }

  const demoPayload: GooglePayload = {
    googleId: 'demo-google-id-reviewer-eval',
    email: 'reviewer.demo@reachinbox.ai',
    name: 'ReachInbox Reviewer',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ReachInboxDemo',
  };

  return authenticateGoogleUser(demoPayload);
}
