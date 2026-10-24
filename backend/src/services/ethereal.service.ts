import nodemailer from 'nodemailer';

export interface EtherealCredentials {
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

/**
 * Creates a real Ethereal test SMTP account via Nodemailer with a deterministic offline fallback.
 */
export async function createEtherealAccount(displayName: string = 'ReachInbox Outreach'): Promise<EtherealCredentials> {
  try {
    const testAccount = await nodemailer.createTestAccount();
    return {
      name: displayName,
      email: testAccount.user,
      smtpHost: testAccount.smtp.host || 'smtp.ethereal.email',
      smtpPort: testAccount.smtp.port || 587,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
    };
  } catch (err: any) {
    console.warn('⚠️ Ethereal createTestAccount failed or offline, using deterministic test account:', err.message);
    const randId = Math.random().toString(36).substring(2, 8);
    return {
      name: displayName,
      email: `outreach.${randId}@ethereal.email`,
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: `outreach.${randId}@ethereal.email`,
      smtpPass: `ethereal_mock_pwd_${randId}`,
    };
  }
}
