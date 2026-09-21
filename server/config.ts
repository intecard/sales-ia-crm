import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : undefined });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DEPLOYMENT_MODE: z.enum(['local', 'hybrid', 'cloud']).default('local'),
  TRUST_PROXY: z.coerce.boolean().default(false),
  APP_SECRET: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default('sales_ai_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(168),
  GEMINI_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
});

export const config = envSchema.parse(process.env);

export function requireDatabaseUrl(): string {
  if (!config.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  return config.DATABASE_URL;
}
