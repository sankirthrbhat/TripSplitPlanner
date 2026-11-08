import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env first, then fallback to root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().trim().optional().default(''),
    JWT_SECRET: z
      .string()
      .trim()
      .default('dev-only-tripsplit-jwt-secret-key-do-not-use-in-prod-987654321'),
    JWT_EXPIRES_IN: z.string().trim().default('7d'),
    CLIENT_ORIGIN: z
      .string()
      .trim()
      .default('http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000'),
    TRUST_PROXY: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .default('false')
      .transform((val) => val === 'true' || val === '1'),
    ALLOW_EMBEDDED_MONGO: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .default('true')
      .transform((val) => val === 'true' || val === '1'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.MONGODB_URI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MONGODB_URI'],
          message: 'MONGODB_URI is required in production environment.',
        });
      }
      if (
        !process.env.JWT_SECRET ||
        data.JWT_SECRET.length < 32 ||
        data.JWT_SECRET.startsWith('dev-only-')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'A strong JWT_SECRET (at least 32 characters) is required in production.',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed at startup.');
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

