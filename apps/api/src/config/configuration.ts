export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32chars',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  sentryDsn: process.env.SENTRY_DSN_API ?? '',
  openFinance: {
    enabled: process.env.OPEN_FINANCE_ENABLED ?? 'false',
    directoryUrl: process.env.OF_DIRECTORY_URL ?? '',
    clientId: process.env.OF_CLIENT_ID ?? '',
    redirectUri:
      process.env.OF_REDIRECT_URI ?? 'http://localhost:3000/api/v1/banking/oauth/callback',
    encryptionKey: process.env.ENCRYPTION_KEY ?? '',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
