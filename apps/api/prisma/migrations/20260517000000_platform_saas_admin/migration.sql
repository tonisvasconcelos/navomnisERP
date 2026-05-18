-- Platform SaaS administration foundation

-- CreateEnum
CREATE TYPE "AuditScope" AS ENUM ('TENANT', 'PLATFORM');
CREATE TYPE "SubscriptionPlanType" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "QuotaResource" AS ENUM ('USERS', 'COMPANIES', 'BRANCHES', 'STORAGE_MB', 'API_CALLS', 'BANK_INTEGRATIONS', 'INVENTORY_RECORDS', 'INVOICES', 'NOTIFICATIONS', 'AI_USAGE', 'QUEUE_JOBS');
CREATE TYPE "DataSubjectRequestType" AS ENUM ('EXPORT', 'DELETE', 'ANONYMIZE');
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "TelemetryEventKind" AS ENUM ('API_REQUEST', 'QUEUE_JOB', 'LOGIN', 'MODULE_USAGE', 'ERROR', 'HEALTH_CHECK');

-- AlterEnum TenantStatus
ALTER TYPE "TenantStatus" ADD VALUE 'BLOCKED';
ALTER TYPE "TenantStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "TenantStatus" ADD VALUE 'TRIAL';
ALTER TYPE "TenantStatus" ADD VALUE 'PENDING_ACTIVATION';

-- AlterTable Tenant
ALTER TABLE "Tenant" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE "Tenant" ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'pt-BR';
ALTER TABLE "Tenant" ADD COLUMN "countryCode" TEXT DEFAULT 'BR';
ALTER TABLE "Tenant" ADD COLUMN "taxId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "blockedAt" TIMESTAMP(3);

-- AlterTable TenantBranding
ALTER TABLE "TenantBranding" ADD COLUMN "faviconUrl" TEXT;
ALTER TABLE "TenantBranding" ADD COLUMN "legalDisplayName" TEXT;
ALTER TABLE "TenantBranding" ADD COLUMN "customDomain" TEXT;
CREATE UNIQUE INDEX "TenantBranding_customDomain_key" ON "TenantBranding"("customDomain");

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "forcePasswordResetAt" TIMESTAMP(3);

-- AlterTable AuditLog
ALTER TABLE "AuditLog" ADD COLUMN "scope" "AuditScope" NOT NULL DEFAULT 'TENANT';
ALTER TABLE "AuditLog" ADD COLUMN "targetTenantId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "platformOperatorId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
CREATE INDEX "AuditLog_scope_createdAt_idx" ON "AuditLog"("scope", "createdAt");
CREATE INDEX "AuditLog_platformOperatorId_createdAt_idx" ON "AuditLog"("platformOperatorId", "createdAt");

-- AlterTable LegalDocumentVersion
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "status" "LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "publishedByPlatformId" TEXT;
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "LegalDocumentVersion_kind_version_key" ON "LegalDocumentVersion"("kind", "version");

-- AlterTable ConsentRecord
ALTER TABLE "ConsentRecord" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "deviceFingerprint" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "legalDocumentVersionId" TEXT;
CREATE INDEX "ConsentRecord_tenantId_kind_idx" ON "ConsentRecord"("tenantId", "kind");

-- CreateTable PlatformOperator
CREATE TABLE "PlatformOperator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "totpPending" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformOperator_email_key" ON "PlatformOperator"("email");

-- CreateTable PlatformPermission
CREATE TABLE "PlatformPermission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "PlatformPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformPermission_code_key" ON "PlatformPermission"("code");

-- CreateTable PlatformRole
CREATE TABLE "PlatformRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformRole_name_key" ON "PlatformRole"("name");

-- CreateTable PlatformRolePermission
CREATE TABLE "PlatformRolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable PlatformOperatorRole
CREATE TABLE "PlatformOperatorRole" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "PlatformOperatorRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformOperatorRole_operatorId_roleId_key" ON "PlatformOperatorRole"("operatorId", "roleId");

-- CreateTable PlatformRefreshToken
CREATE TABLE "PlatformRefreshToken" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformRefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformRefreshToken_jti_key" ON "PlatformRefreshToken"("jti");
CREATE INDEX "PlatformRefreshToken_operatorId_revokedAt_idx" ON "PlatformRefreshToken"("operatorId", "revokedAt");

-- CreateTable PlatformSession
CREATE TABLE "PlatformSession" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "deviceFingerprint" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformSession_operatorId_revokedAt_idx" ON "PlatformSession"("operatorId", "revokedAt");

-- CreateTable PlatformLoginHistory
CREATE TABLE "PlatformLoginHistory" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformLoginHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformLoginHistory_operatorId_createdAt_idx" ON "PlatformLoginHistory"("operatorId", "createdAt");

-- CreateTable LoginHistory
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

-- CreateTable DeviceRegistry
CREATE TABLE "DeviceRegistry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastIp" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceRegistry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeviceRegistry_userId_fingerprint_key" ON "DeviceRegistry"("userId", "fingerprint");

-- CreateTable SubscriptionPlan
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" "SubscriptionPlanType" NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateTable PlanFeature
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanFeature_planId_moduleKey_key" ON "PlanFeature"("planId", "moduleKey");

-- CreateTable PlanQuota
CREATE TABLE "PlanQuota" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "resource" "QuotaResource" NOT NULL,
    "limitValue" INTEGER NOT NULL,
    CONSTRAINT "PlanQuota_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanQuota_planId_resource_key" ON "PlanQuota"("planId", "resource");

-- CreateTable TenantSubscription
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "TenantSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantSubscription_planId_status_idx" ON "TenantSubscription"("planId", "status");

-- CreateTable TenantUsageSnapshot
CREATE TABLE "TenantUsageSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resource" "QuotaResource" NOT NULL,
    "usedValue" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantUsageSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantUsageSnapshot_tenantId_resource_periodKey_key" ON "TenantUsageSnapshot"("tenantId", "resource", "periodKey");

-- CreateTable TenantFeatureOverride
CREATE TABLE "TenantFeatureOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantFeatureOverride_tenantId_moduleKey_key" ON "TenantFeatureOverride"("tenantId", "moduleKey");

-- CreateTable TelemetryEvent
CREATE TABLE "TelemetryEvent" (
    "id" TEXT NOT NULL,
    "kind" "TelemetryEventKind" NOT NULL,
    "tenantId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TelemetryEvent_kind_createdAt_idx" ON "TelemetryEvent"("kind", "createdAt");
CREATE INDEX "TelemetryEvent_tenantId_createdAt_idx" ON "TelemetryEvent"("tenantId", "createdAt");

-- CreateTable ApiUsageRollup
CREATE TABLE "ApiUsageRollup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "routePattern" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsageRollup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiUsageRollup_tenantId_routePattern_periodKey_key" ON "ApiUsageRollup"("tenantId", "routePattern", "periodKey");

-- CreateTable QueueHealthSnapshot
CREATE TABLE "QueueHealthSnapshot" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "waiting" INTEGER NOT NULL,
    "active" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "completed" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueHealthSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QueueHealthSnapshot_queueName_capturedAt_idx" ON "QueueHealthSnapshot"("queueName", "capturedAt");

-- CreateTable DataSubjectRequest
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "requestType" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataSubjectRequest_tenantId_status_idx" ON "DataSubjectRequest"("tenantId", "status");

-- CreateTable DataRetentionPolicy
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataRetentionPolicy_category_key" ON "DataRetentionPolicy"("category");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_platformOperatorId_fkey" FOREIGN KEY ("platformOperatorId") REFERENCES "PlatformOperator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_publishedByPlatformId_fkey" FOREIGN KEY ("publishedByPlatformId") REFERENCES "PlatformOperator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_legalDocumentVersionId_fkey" FOREIGN KEY ("legalDocumentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PlatformPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformOperatorRole" ADD CONSTRAINT "PlatformOperatorRole_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformOperatorRole" ADD CONSTRAINT "PlatformOperatorRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRefreshToken" ADD CONSTRAINT "PlatformRefreshToken_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformLoginHistory" ADD CONSTRAINT "PlatformLoginHistory_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceRegistry" ADD CONSTRAINT "DeviceRegistry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanQuota" ADD CONSTRAINT "PlanQuota_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantUsageSnapshot" ADD CONSTRAINT "TenantUsageSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
