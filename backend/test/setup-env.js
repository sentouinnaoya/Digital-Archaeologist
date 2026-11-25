// Deterministic test environment. Loaded by both Jest configurations before
// any module (and therefore before ConfigModule.forRoot) is evaluated.
process.env.MONGO_URI =
  process.env.MONGO_TEST_URI ??
  'mongodb://127.0.0.1:27017/digital_archaeologist_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.JWT_REFRESH_TTL_SECONDS = '604800';
process.env.REFRESH_COOKIE_MAX_AGE_MS = '604800000';
process.env.PORT = '3001';
process.env.API_PREFIX = 'api/v1';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.COOKIE_SECURE = 'false';
process.env.ANALYZER_VERSION = '0.1.0';
process.env.STORAGE_ROOT = './test-storage';
process.env.CLONE_TIMEOUT_MS = '60000';
process.env.MAX_CLONE_SIZE_MB = '50';
process.env.MAX_COMMITS_ANALYZED = '50';
process.env.MAX_ZIP_SIZE_MB = '5';
process.env.MAX_ZIP_ENTRIES = '100';
process.env.MAX_ZIP_FILE_SIZE_MB = '1';
process.env.MAX_ZIP_TOTAL_SIZE_MB = '5';
process.env.MAX_SOURCE_FILES_ANALYZED = '50';
process.env.MAX_SOURCE_FILE_SIZE_MB = '1';
process.env.AI_ENABLED = 'false';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
process.env.OLLAMA_MODEL = 'test-local-model';
process.env.AI_TIMEOUT_MS = '5000';
process.env.AI_MAX_EVIDENCE_ITEMS = '10';
process.env.REPORT_MAX_ITEMS = '10';
