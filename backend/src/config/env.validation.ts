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
    MAX_ZIP_SIZE_MB: z.coerce.number().int().positive().default(50),
    MAX_ZIP_ENTRIES: z.coerce.number().int().positive().default(5000),
    MAX_ZIP_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
    MAX_ZIP_TOTAL_SIZE_MB: z.coerce.number().int().positive().default(200),
    MAX_SOURCE_FILES_ANALYZED: z.coerce.number().int().positive().default(500),
    MAX_SOURCE_FILE_SIZE_MB: z.coerce.number().int().positive().default(2),
    MAX_DIFF_LINES: z.coerce.number().int().positive().default(2000),
    AI_ENABLED: booleanString.default('false'),
    OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
    OLLAMA_MODEL: z.string().min(1).default('llama3.2'),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    AI_MAX_EVIDENCE_ITEMS: z.coerce.number().int().positive().default(20),
    REPORT_MAX_ITEMS: z.coerce.number().int().positive().default(20),
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
