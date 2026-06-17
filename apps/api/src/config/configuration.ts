export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32chars',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  platformJwtAccessSecret:
    process.env.PLATFORM_JWT_ACCESS_SECRET ?? 'dev-platform-access-secret-change-me-32',
  platformJwtRefreshSecret:
    process.env.PLATFORM_JWT_REFRESH_SECRET ?? 'dev-platform-refresh-secret-change-me-32',
  platformJwtAccessExpires: process.env.PLATFORM_JWT_ACCESS_EXPIRES ?? '15m',
  platformJwtRefreshExpires: process.env.PLATFORM_JWT_REFRESH_EXPIRES ?? '7d',
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
  adminWebUrl: process.env.ADMIN_WEB_URL ?? 'http://localhost:5174',
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
  featureFlags: {
    uomEnforcementDefault: process.env.UOM_ENFORCEMENT_DEFAULT ?? 'false',
    poApprovalRequiredDefault: process.env.PO_APPROVAL_REQUIRED_DEFAULT ?? 'false',
    fefoSalesDefault: process.env.FEFO_SALES_DEFAULT ?? 'false',
  },
  cadeg: {
    dataDir: process.env.CADEG_DATA_DIR ?? '',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
