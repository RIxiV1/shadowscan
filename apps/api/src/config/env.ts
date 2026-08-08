import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

// Fail-fast environment validation.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters of high-entropy random data'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BOOTSTRAP_TOKEN: z.string().min(8).optional(),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_ROWS_PER_UPLOAD: z.coerce.number().int().positive().default(50_000),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@shadowscan.local'),
  SEED_ADMIN_PASSWORD: z.string().min(10).default('ShadowScan!2026'),
  SEED_ADMIN_NAME: z.string().min(1).default('Security Admin'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Written to stderr directly: the logger itself depends on this module.
  process.stderr.write(`\nInvalid environment configuration:\n${issues}\n\n`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  // Parsed once at boot so the CORS callback stays an O(1) set lookup per request.
  corsOrigins: new Set(
    raw.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
} as const;

export type Env = typeof env;
