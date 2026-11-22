import { z } from 'zod';

const booleanString = z.enum(['true', 'false']);

export const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    API_PREFIX: z.string().min(1).default('api/v1'),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    MONGO_URI: z.string().min(1),
    MONGO_TEST_URI: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
    REFRESH_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(604800000),
    COOKIE_SECURE: booleanString.default('false'),
    STORAGE_ROOT: z.string().min(1).default('./storage'),
    ANALYZER_VERSION: z.string().min(1).default('0.1.0'),
    CLONE_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
    MAX_CLONE_SIZE_MB: z.coerce.number().int().positive().default(500),
    MAX_COMMITS_ANALYZED: z.coerce.number().int().positive().default(2000),
  })
  .passthrough();

export type ValidatedEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}
