/**
 * Executado antes de carregar os ficheiros de teste de integração.
 * No GitHub Actions use TEST_DATABASE_URL (Postgres do job).
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PROCESS_ROLE = process.env.PROCESS_ROLE || 'api';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://navomnis:navomnis@127.0.0.1:5432/navomnis?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.WEB_URL = process.env.WEB_URL || 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-32chars!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-32chars!!';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'integration-banking-vault-key-32b';
