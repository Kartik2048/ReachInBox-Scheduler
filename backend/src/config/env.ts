import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('reachinbox_super_secret_jwt_key_change_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),
  RUN_WORKER_IN_API: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true' || val === '1'),
  SMTP_FALLBACK_ON_PORT_BLOCK: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true' || val === '1'),
  ALLOW_DEMO_AUTH: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true' || val === '1'),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Environment validation failed.');
}

export const env = parsed.data;
export type EnvConfig = z.infer<typeof envSchema>;
