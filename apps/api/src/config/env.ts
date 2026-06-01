import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  AWS_ACCESS_KEY_ID: z.string().default('dev-placeholder'),
  AWS_SECRET_ACCESS_KEY: z.string().default('dev-placeholder'),
  AWS_REGION: z.string().default('sa-east-1'),
  AWS_BUCKET: z.string().default('my-website-bucket'),

  GOOGLE_MAPS_API_KEY: z.string().default(''),

  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is required'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),

  WHATSAPP_PROVIDER: z.enum(['zapi', 'twilio']).optional(),
  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] ❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
