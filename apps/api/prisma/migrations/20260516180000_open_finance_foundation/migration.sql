-- Open Finance Brasil foundation (additive; no V1 table changes)

CREATE TYPE "BankConnectionStatus" AS ENUM ('PENDING_CONSENT', 'ACTIVE', 'SUSPENDED', 'ERROR', 'REVOKED');
CREATE TYPE "BankConsentStatus" AS ENUM ('AWAITING_AUTHORISATION', 'AUTHORISED', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'PREPAID', 'PAYMENT', 'OTHER');
CREATE TYPE "BankTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'PIX', 'TED', 'DOC', 'BOLETO', 'CARD', 'FEE', 'TRANSFER', 'OTHER');
CREATE TYPE "BankSyncJobType" AS ENUM ('ACCOUNTS', 'BALANCES', 'TRANSACTIONS_HISTORICAL', 'TRANSACTIONS_INCREMENTAL', 'CONSENT_CHECK');
CREATE TYPE "BankSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReconciliationMatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'POSTED');
CREATE TYPE "BankingAccessAction" AS ENUM ('READ_ACCOUNTS', 'READ_TRANSACTIONS', 'START_CONSENT', 'REVOKE_CONSENT', 'SYNC', 'RECONCILE');

CREATE TABLE "FinancialInstitution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "participantId" TEXT NOT NULL,
    "ispb" TEXT NOT NULL,
    "compe" TEXT,
    "brandName" TEXT NOT NULL,
    "apiBaseUrl" TEXT,
    "supportedScopes" JSONB,
    "isSandbox" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialInstitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "authorizedById" TEXT,
    "externalId" TEXT,
    "status" "BankConsentStatus" NOT NULL DEFAULT 'AWAITING_AUTHORISATION',
    "scopes" JSONB,
    "expiresAt" TIMESTAMP(3),
    "authorisedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankOAuthSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankOAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankCredentialVault" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "accessCipher" TEXT NOT NULL,
    "accessIv" TEXT NOT NULL,
    "refreshCipher" TEXT,
    "refreshIv" TEXT,
    "expiresAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankCredentialVault_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "branchId" TEXT,
    "externalId" TEXT NOT NULL,
    "accountType" "BankAccountType" NOT NULL DEFAULT 'CHECKING',
    "branchNumber" TEXT,
    "accountNumber" TEXT NOT NULL,
    "checkDigit" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "transactionType" "BankTransactionType" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(18,2) NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "documentNumber" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PixTransactionDetail" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "endToEndId" TEXT,
    "pixKey" TEXT,
    "counterpartyName" TEXT,
    "counterpartyDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PixTransactionDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankSyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "consentId" TEXT,
    "jobType" "BankSyncJobType" NOT NULL,
    "status" "BankSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "cursor" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankWebhookInbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankWebhookInbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountTolerance" DECIMAL(18,4) NOT NULL DEFAULT 0.01,
    "dayTolerance" INTEGER NOT NULL DEFAULT 3,
    "matchers" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReconciliationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "status" "ReconciliationMatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "confidence" DECIMAL(5,4) NOT NULL,
    "matchedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankingAccessLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT NOT NULL,
    "action" "BankingAccessAction" NOT NULL,
    "resource" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankingAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialInstitution_participantId_key" ON "FinancialInstitution"("participantId");
CREATE INDEX "FinancialInstitution_tenantId_ispb_idx" ON "FinancialInstitution"("tenantId", "ispb");

CREATE UNIQUE INDEX "BankConnection_tenantId_companyId_institutionId_key" ON "BankConnection"("tenantId", "companyId", "institutionId");
CREATE INDEX "BankConnection_tenantId_companyId_status_idx" ON "BankConnection"("tenantId", "companyId", "status");

CREATE INDEX "BankConsent_tenantId_companyId_status_idx" ON "BankConsent"("tenantId", "companyId", "status");
CREATE INDEX "BankConsent_connectionId_idx" ON "BankConsent"("connectionId");

CREATE UNIQUE INDEX "BankOAuthSession_consentId_key" ON "BankOAuthSession"("consentId");
CREATE UNIQUE INDEX "BankOAuthSession_state_key" ON "BankOAuthSession"("state");
CREATE INDEX "BankOAuthSession_tenantId_expiresAt_idx" ON "BankOAuthSession"("tenantId", "expiresAt");

CREATE UNIQUE INDEX "BankCredentialVault_consentId_key" ON "BankCredentialVault"("consentId");
CREATE INDEX "BankCredentialVault_tenantId_consentId_idx" ON "BankCredentialVault"("tenantId", "consentId");

CREATE UNIQUE INDEX "BankAccount_tenantId_connectionId_externalId_key" ON "BankAccount"("tenantId", "connectionId", "externalId");
CREATE INDEX "BankAccount_tenantId_companyId_idx" ON "BankAccount"("tenantId", "companyId");

CREATE INDEX "BankBalance_tenantId_accountId_asOf_idx" ON "BankBalance"("tenantId", "accountId", "asOf");

CREATE UNIQUE INDEX "BankTransaction_tenantId_accountId_externalId_key" ON "BankTransaction"("tenantId", "accountId", "externalId");
CREATE INDEX "BankTransaction_tenantId_companyId_bookedAt_idx" ON "BankTransaction"("tenantId", "companyId", "bookedAt");
CREATE INDEX "BankTransaction_tenantId_accountId_transactionType_idx" ON "BankTransaction"("tenantId", "accountId", "transactionType");

CREATE UNIQUE INDEX "PixTransactionDetail_transactionId_key" ON "PixTransactionDetail"("transactionId");
CREATE INDEX "PixTransactionDetail_endToEndId_idx" ON "PixTransactionDetail"("endToEndId");

CREATE INDEX "BankSyncJob_tenantId_connectionId_status_idx" ON "BankSyncJob"("tenantId", "connectionId", "status");

CREATE UNIQUE INDEX "BankWebhookInbox_eventId_key" ON "BankWebhookInbox"("eventId");
CREATE INDEX "BankWebhookInbox_tenantId_processedAt_idx" ON "BankWebhookInbox"("tenantId", "processedAt");

CREATE INDEX "ReconciliationRule_tenantId_companyId_isActive_idx" ON "ReconciliationRule"("tenantId", "companyId", "isActive");

CREATE INDEX "ReconciliationMatch_tenantId_companyId_status_idx" ON "ReconciliationMatch"("tenantId", "companyId", "status");
CREATE INDEX "ReconciliationMatch_bankTransactionId_idx" ON "ReconciliationMatch"("bankTransactionId");

CREATE INDEX "BankingAccessLog_tenantId_userId_createdAt_idx" ON "BankingAccessLog"("tenantId", "userId", "createdAt");

ALTER TABLE "FinancialInstitution" ADD CONSTRAINT "FinancialInstitution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankConsent" ADD CONSTRAINT "BankConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankConsent" ADD CONSTRAINT "BankConsent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankConsent" ADD CONSTRAINT "BankConsent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankConsent" ADD CONSTRAINT "BankConsent_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankOAuthSession" ADD CONSTRAINT "BankOAuthSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankOAuthSession" ADD CONSTRAINT "BankOAuthSession_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "BankConsent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankCredentialVault" ADD CONSTRAINT "BankCredentialVault_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "BankConsent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankBalance" ADD CONSTRAINT "BankBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankBalance" ADD CONSTRAINT "BankBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankBalance" ADD CONSTRAINT "BankBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PixTransactionDetail" ADD CONSTRAINT "PixTransactionDetail_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankSyncJob" ADD CONSTRAINT "BankSyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankSyncJob" ADD CONSTRAINT "BankSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankSyncJob" ADD CONSTRAINT "BankSyncJob_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "BankConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankWebhookInbox" ADD CONSTRAINT "BankWebhookInbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationRule" ADD CONSTRAINT "ReconciliationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationRule" ADD CONSTRAINT "ReconciliationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankingAccessLog" ADD CONSTRAINT "BankingAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankingAccessLog" ADD CONSTRAINT "BankingAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
