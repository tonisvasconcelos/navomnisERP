-- Brazilian fiscal and posting foundation.
-- Additive migration: setup/rule tables, fiscal document snapshots, immutable ledgers,
-- and posting preview journals. Legal formulas remain parameter-driven, not hardcoded.

CREATE TYPE "FiscalJurisdictionLevel" AS ENUM ('FEDERAL', 'STATE', 'MUNICIPAL', 'FOREIGN');
CREATE TYPE "BrazilianFiscalRegime" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'RURAL_PRODUCER', 'EXEMPT');
CREATE TYPE "TaxpayerType" AS ENUM ('CONTRIBUTOR', 'NON_CONTRIBUTOR', 'EXEMPT', 'CONSUMER', 'FOREIGN');
CREATE TYPE "FiscalDocumentDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "FiscalDocumentKind" AS ENUM ('SALES_QUOTE', 'SALES_ORDER', 'SALES_INVOICE', 'SALES_CREDIT_NOTE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_INVOICE', 'SERVICE_INVOICE', 'TAX_ADJUSTMENT');
CREATE TYPE "FiscalDocumentAuthorizationStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PENDING_AUTHORIZATION', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'CONTINGENCY', 'POSTED');
CREATE TYPE "BrazilianTaxKind" AS ENUM ('ICMS', 'ICMS_ST', 'IPI', 'ISS', 'PIS', 'COFINS', 'DIFAL', 'FCP', 'IRRF', 'CSLL', 'INSS', 'FUNRURAL', 'FREIGHT_TAX', 'IMPORT_DUTY', 'IBS', 'CBS', 'IS');
CREATE TYPE "TaxRuleBaseStrategy" AS ENUM ('LINE_AMOUNT', 'DOCUMENT_AMOUNT', 'CUSTOMS_VALUE', 'FREIGHT_AMOUNT', 'SERVICE_AMOUNT', 'PREVIOUS_TAX_AMOUNT', 'FORMULA');
CREATE TYPE "PostingJournalStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'VALIDATED', 'POSTED', 'CANCELLED');
CREATE TYPE "LedgerSide" AS ENUM ('DEBIT', 'CREDIT');

CREATE TABLE "FiscalJurisdiction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" "FiscalJurisdictionLevel" NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'BR',
  "stateCode" TEXT,
  "municipalityCode" TEXT,
  "ibgeCode" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalJurisdiction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalRegimeSetup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "regime" "BrazilianFiscalRegime" NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalRegimeSetup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxArea" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "originJurisdictionId" TEXT,
  "destinationJurisdictionId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalOperationType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "direction" "FiscalDocumentDirection" NOT NULL,
  "defaultCfop" TEXT,
  "nfModel" TEXT,
  "affectsInventory" BOOLEAN NOT NULL DEFAULT false,
  "affectsFinancial" BOOLEAN NOT NULL DEFAULT true,
  "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalOperationType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxDeterminationRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "taxKind" "BrazilianTaxKind" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "operationTypeId" TEXT,
  "businessTaxGroupId" TEXT,
  "productTaxGroupId" TEXT,
  "originJurisdictionId" TEXT,
  "destinationJurisdictionId" TEXT,
  "fiscalRegime" "BrazilianFiscalRegime",
  "taxpayerType" "TaxpayerType",
  "cfop" TEXT,
  "cst" TEXT,
  "benefitCode" TEXT,
  "baseStrategy" "TaxRuleBaseStrategy" NOT NULL DEFAULT 'LINE_AMOUNT',
  "formulaCode" TEXT,
  "rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "reductionRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "mvaRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "fcpRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "isRecoverable" BOOLEAN NOT NULL DEFAULT false,
  "isWithheld" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "parameters" JSONB,
  "legalReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxDeterminationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductFiscalProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "ncm" TEXT,
  "cest" TEXT,
  "fiscalOriginCode" TEXT,
  "fiscalCategory" TEXT,
  "productTaxGroupId" TEXT,
  "ipiClassCode" TEXT,
  "benefitCode" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductFiscalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyFiscalProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "cnpj" TEXT,
  "stateRegistration" TEXT,
  "municipalRegistration" TEXT,
  "taxpayerType" "TaxpayerType" NOT NULL DEFAULT 'CONTRIBUTOR',
  "fiscalRegime" "BrazilianFiscalRegime",
  "suframa" TEXT,
  "fiscalCategory" TEXT,
  "businessTaxGroupId" TEXT,
  "exemptions" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyFiscalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "operationTypeId" TEXT,
  "kind" "FiscalDocumentKind" NOT NULL,
  "direction" "FiscalDocumentDirection" NOT NULL,
  "status" "FiscalDocumentAuthorizationStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceDocumentType" TEXT,
  "sourceDocumentId" TEXT,
  "number" TEXT,
  "series" TEXT,
  "fiscalDocumentKey" TEXT,
  "accessKey" TEXT,
  "protocolNumber" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postingDate" TIMESTAMP(3),
  "totalProducts" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalServices" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalWithheld" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalDocument" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "xmlStorageKey" TEXT,
  "authorizationMessage" TEXT,
  "rejectionCode" TEXT,
  "rejectionReason" TEXT,
  "contingencyMode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalDocumentLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fiscalDocumentId" TEXT NOT NULL,
  "itemId" TEXT,
  "lineNumber" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
  "unitAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "lineAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "freightAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "cfop" TEXT,
  "ncm" TEXT,
  "cest" TEXT,
  "cstIcms" TEXT,
  "cstPisCofins" TEXT,
  "serviceCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalDocumentLineTax" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fiscalDocumentLineId" TEXT NOT NULL,
  "taxKind" "BrazilianTaxKind" NOT NULL,
  "taxDeterminationRuleId" TEXT,
  "jurisdictionId" TEXT,
  "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "baseReductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "recoverableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "withheldAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "calculationTrace" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentLineTax_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostingJournal" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalDocumentId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "status" "PostingJournalStatus" NOT NULL DEFAULT 'DRAFT',
  "postingDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "validationErrors" JSONB,
  "previewPayload" JSONB,
  "postedAt" TIMESTAMP(3),
  "postedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostingJournal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostingJournalLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "postingJournalId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "ledger" TEXT NOT NULL,
  "accountNo" TEXT,
  "side" "LedgerSide" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'BRL',
  "description" TEXT,
  "dimensions" JSONB,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostingJournalLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostingSetup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessTaxGroupId" TEXT,
  "productTaxGroupId" TEXT,
  "receivableAccount" TEXT,
  "payableAccount" TEXT,
  "revenueAccount" TEXT,
  "expenseAccount" TEXT,
  "inventoryAccount" TEXT,
  "cogsAccount" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostingSetup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxPostingSetup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "taxKind" "BrazilianTaxKind" NOT NULL,
  "payableAccount" TEXT,
  "recoverableAccount" TEXT,
  "expenseAccount" TEXT,
  "settlementAccount" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxPostingSetup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalPostingSetup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "operationTypeId" TEXT,
  "documentKind" "FiscalDocumentKind",
  "fiscalLedgerTemplate" JSONB,
  "requiresTaxLedger" BOOLEAN NOT NULL DEFAULT true,
  "requiresGlPosting" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalPostingSetup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "documentType" TEXT,
  "documentId" TEXT,
  "side" "LedgerSide" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "openAmount" DECIMAL(18,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "isOpen" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "documentType" TEXT,
  "documentId" TEXT,
  "side" "LedgerSide" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "openAmount" DECIMAL(18,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "isOpen" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "bankAccountCode" TEXT NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "documentType" TEXT,
  "documentId" TEXT,
  "side" "LedgerSide" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taxKind" "BrazilianTaxKind" NOT NULL,
  "jurisdictionId" TEXT,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "documentType" TEXT,
  "documentId" TEXT,
  "fiscalDocumentLineTaxId" TEXT,
  "side" "LedgerSide" NOT NULL,
  "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,2) NOT NULL,
  "recoverableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "withheldAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "isSettled" BOOLEAN NOT NULL DEFAULT false,
  "settlementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxSettlementLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taxKind" "BrazilianTaxKind" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "payableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  CONSTRAINT "TaxSettlementLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalJurisdiction_tenantId_code_effectiveFrom_key" ON "FiscalJurisdiction"("tenantId", "code", "effectiveFrom");
CREATE INDEX "FiscalJurisdiction_tenantId_level_stateCode_municipalityCode_idx" ON "FiscalJurisdiction"("tenantId", "level", "stateCode", "municipalityCode");
CREATE INDEX "FiscalJurisdiction_tenantId_isActive_effectiveFrom_effectiveTo_idx" ON "FiscalJurisdiction"("tenantId", "isActive", "effectiveFrom", "effectiveTo");
CREATE INDEX "FiscalRegimeSetup_tenantId_companyId_validFrom_validTo_idx" ON "FiscalRegimeSetup"("tenantId", "companyId", "validFrom", "validTo");
CREATE INDEX "FiscalRegimeSetup_tenantId_regime_validFrom_idx" ON "FiscalRegimeSetup"("tenantId", "regime", "validFrom");
CREATE UNIQUE INDEX "TaxArea_tenantId_code_effectiveFrom_key" ON "TaxArea"("tenantId", "code", "effectiveFrom");
CREATE INDEX "TaxArea_tenantId_isActive_effectiveFrom_effectiveTo_idx" ON "TaxArea"("tenantId", "isActive", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "TaxGroup_tenantId_kind_code_key" ON "TaxGroup"("tenantId", "kind", "code");
CREATE INDEX "TaxGroup_tenantId_kind_isActive_idx" ON "TaxGroup"("tenantId", "kind", "isActive");
CREATE UNIQUE INDEX "FiscalOperationType_tenantId_code_key" ON "FiscalOperationType"("tenantId", "code");
CREATE INDEX "FiscalOperationType_tenantId_direction_isActive_idx" ON "FiscalOperationType"("tenantId", "direction", "isActive");
CREATE INDEX "TaxDeterminationRule_tenantId_taxKind_isActive_effectiveFrom_effectiveTo_idx" ON "TaxDeterminationRule"("tenantId", "taxKind", "isActive", "effectiveFrom", "effectiveTo");
CREATE INDEX "TaxDeterminationRule_tenantId_operationTypeId_businessTaxGroupId_productTaxGroupId_priority_idx" ON "TaxDeterminationRule"("tenantId", "operationTypeId", "businessTaxGroupId", "productTaxGroupId", "priority");
CREATE UNIQUE INDEX "ProductFiscalProfile_itemId_key" ON "ProductFiscalProfile"("itemId");
CREATE INDEX "ProductFiscalProfile_tenantId_ncm_cest_idx" ON "ProductFiscalProfile"("tenantId", "ncm", "cest");
CREATE INDEX "ProductFiscalProfile_tenantId_productTaxGroupId_idx" ON "ProductFiscalProfile"("tenantId", "productTaxGroupId");
CREATE UNIQUE INDEX "PartyFiscalProfile_partyId_key" ON "PartyFiscalProfile"("partyId");
CREATE INDEX "PartyFiscalProfile_tenantId_cnpj_idx" ON "PartyFiscalProfile"("tenantId", "cnpj");
CREATE INDEX "PartyFiscalProfile_tenantId_taxpayerType_fiscalRegime_idx" ON "PartyFiscalProfile"("tenantId", "taxpayerType", "fiscalRegime");
CREATE UNIQUE INDEX "FiscalDocument_tenantId_kind_series_number_key" ON "FiscalDocument"("tenantId", "kind", "series", "number");
CREATE INDEX "FiscalDocument_tenantId_companyId_issueDate_idx" ON "FiscalDocument"("tenantId", "companyId", "issueDate");
CREATE INDEX "FiscalDocument_tenantId_partyId_issueDate_idx" ON "FiscalDocument"("tenantId", "partyId", "issueDate");
CREATE INDEX "FiscalDocument_tenantId_status_issueDate_idx" ON "FiscalDocument"("tenantId", "status", "issueDate");
CREATE INDEX "FiscalDocument_tenantId_sourceDocumentType_sourceDocumentId_idx" ON "FiscalDocument"("tenantId", "sourceDocumentType", "sourceDocumentId");
CREATE UNIQUE INDEX "FiscalDocumentLine_fiscalDocumentId_lineNumber_key" ON "FiscalDocumentLine"("fiscalDocumentId", "lineNumber");
CREATE INDEX "FiscalDocumentLine_tenantId_fiscalDocumentId_idx" ON "FiscalDocumentLine"("tenantId", "fiscalDocumentId");
CREATE INDEX "FiscalDocumentLine_tenantId_itemId_idx" ON "FiscalDocumentLine"("tenantId", "itemId");
CREATE INDEX "FiscalDocumentLineTax_tenantId_taxKind_createdAt_idx" ON "FiscalDocumentLineTax"("tenantId", "taxKind", "createdAt");
CREATE INDEX "FiscalDocumentLineTax_tenantId_fiscalDocumentLineId_idx" ON "FiscalDocumentLineTax"("tenantId", "fiscalDocumentLineId");
CREATE INDEX "PostingJournal_tenantId_companyId_postingDate_idx" ON "PostingJournal"("tenantId", "companyId", "postingDate");
CREATE INDEX "PostingJournal_tenantId_sourceType_sourceId_idx" ON "PostingJournal"("tenantId", "sourceType", "sourceId");
CREATE INDEX "PostingJournal_tenantId_status_postingDate_idx" ON "PostingJournal"("tenantId", "status", "postingDate");
CREATE UNIQUE INDEX "PostingJournalLine_postingJournalId_lineNumber_key" ON "PostingJournalLine"("postingJournalId", "lineNumber");
CREATE INDEX "PostingJournalLine_tenantId_ledger_createdAt_idx" ON "PostingJournalLine"("tenantId", "ledger", "createdAt");
CREATE INDEX "PostingSetup_tenantId_businessTaxGroupId_productTaxGroupId_effectiveFrom_idx" ON "PostingSetup"("tenantId", "businessTaxGroupId", "productTaxGroupId", "effectiveFrom");
CREATE UNIQUE INDEX "TaxPostingSetup_tenantId_taxKind_effectiveFrom_key" ON "TaxPostingSetup"("tenantId", "taxKind", "effectiveFrom");
CREATE INDEX "TaxPostingSetup_tenantId_taxKind_isActive_idx" ON "TaxPostingSetup"("tenantId", "taxKind", "isActive");
CREATE INDEX "FiscalPostingSetup_tenantId_operationTypeId_documentKind_effectiveFrom_idx" ON "FiscalPostingSetup"("tenantId", "operationTypeId", "documentKind", "effectiveFrom");
CREATE INDEX "CustomerLedgerEntry_tenantId_customerId_postingDate_idx" ON "CustomerLedgerEntry"("tenantId", "customerId", "postingDate");
CREATE INDEX "CustomerLedgerEntry_tenantId_companyId_isOpen_dueDate_idx" ON "CustomerLedgerEntry"("tenantId", "companyId", "isOpen", "dueDate");
CREATE INDEX "SupplierLedgerEntry_tenantId_supplierId_postingDate_idx" ON "SupplierLedgerEntry"("tenantId", "supplierId", "postingDate");
CREATE INDEX "SupplierLedgerEntry_tenantId_companyId_isOpen_dueDate_idx" ON "SupplierLedgerEntry"("tenantId", "companyId", "isOpen", "dueDate");
CREATE INDEX "BankLedgerEntry_tenantId_companyId_bankAccountCode_postingDate_idx" ON "BankLedgerEntry"("tenantId", "companyId", "bankAccountCode", "postingDate");
CREATE INDEX "TaxLedgerEntry_tenantId_companyId_taxKind_postingDate_idx" ON "TaxLedgerEntry"("tenantId", "companyId", "taxKind", "postingDate");
CREATE INDEX "TaxLedgerEntry_tenantId_isSettled_taxKind_idx" ON "TaxLedgerEntry"("tenantId", "isSettled", "taxKind");
CREATE INDEX "TaxLedgerEntry_tenantId_documentType_documentId_idx" ON "TaxLedgerEntry"("tenantId", "documentType", "documentId");
CREATE UNIQUE INDEX "TaxSettlementLedgerEntry_tenantId_companyId_taxKind_periodStart_periodEnd_key" ON "TaxSettlementLedgerEntry"("tenantId", "companyId", "taxKind", "periodStart", "periodEnd");
CREATE INDEX "TaxSettlementLedgerEntry_tenantId_companyId_status_idx" ON "TaxSettlementLedgerEntry"("tenantId", "companyId", "status");

ALTER TABLE "FiscalJurisdiction" ADD CONSTRAINT "FiscalJurisdiction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalRegimeSetup" ADD CONSTRAINT "FiscalRegimeSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalRegimeSetup" ADD CONSTRAINT "FiscalRegimeSetup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxArea" ADD CONSTRAINT "TaxArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxArea" ADD CONSTRAINT "TaxArea_originJurisdictionId_fkey" FOREIGN KEY ("originJurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxArea" ADD CONSTRAINT "TaxArea_destinationJurisdictionId_fkey" FOREIGN KEY ("destinationJurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxGroup" ADD CONSTRAINT "TaxGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalOperationType" ADD CONSTRAINT "FiscalOperationType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxDeterminationRule" ADD CONSTRAINT "TaxDeterminationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxDeterminationRule" ADD CONSTRAINT "TaxDeterminationRule_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "FiscalOperationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxDeterminationRule" ADD CONSTRAINT "TaxDeterminationRule_businessTaxGroupId_fkey" FOREIGN KEY ("businessTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxDeterminationRule" ADD CONSTRAINT "TaxDeterminationRule_productTaxGroupId_fkey" FOREIGN KEY ("productTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxDeterminationRule" ADD CONSTRAINT "TaxDeterminationRule_originJurisdictionId_fkey" FOREIGN KEY ("originJurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxDeterminationRule" ADD CONSTRAINT "TaxDeterminationRule_destinationJurisdictionId_fkey" FOREIGN KEY ("destinationJurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductFiscalProfile" ADD CONSTRAINT "ProductFiscalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFiscalProfile" ADD CONSTRAINT "ProductFiscalProfile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFiscalProfile" ADD CONSTRAINT "ProductFiscalProfile_productTaxGroupId_fkey" FOREIGN KEY ("productTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyFiscalProfile" ADD CONSTRAINT "PartyFiscalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyFiscalProfile" ADD CONSTRAINT "PartyFiscalProfile_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyFiscalProfile" ADD CONSTRAINT "PartyFiscalProfile_businessTaxGroupId_fkey" FOREIGN KEY ("businessTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "FiscalOperationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLine" ADD CONSTRAINT "FiscalDocumentLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLine" ADD CONSTRAINT "FiscalDocumentLine_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLine" ADD CONSTRAINT "FiscalDocumentLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLineTax" ADD CONSTRAINT "FiscalDocumentLineTax_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLineTax" ADD CONSTRAINT "FiscalDocumentLineTax_fiscalDocumentLineId_fkey" FOREIGN KEY ("fiscalDocumentLineId") REFERENCES "FiscalDocumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLineTax" ADD CONSTRAINT "FiscalDocumentLineTax_taxDeterminationRuleId_fkey" FOREIGN KEY ("taxDeterminationRuleId") REFERENCES "TaxDeterminationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLineTax" ADD CONSTRAINT "FiscalDocumentLineTax_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostingJournal" ADD CONSTRAINT "PostingJournal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostingJournal" ADD CONSTRAINT "PostingJournal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostingJournal" ADD CONSTRAINT "PostingJournal_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostingJournalLine" ADD CONSTRAINT "PostingJournalLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostingJournalLine" ADD CONSTRAINT "PostingJournalLine_postingJournalId_fkey" FOREIGN KEY ("postingJournalId") REFERENCES "PostingJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostingSetup" ADD CONSTRAINT "PostingSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostingSetup" ADD CONSTRAINT "PostingSetup_businessTaxGroupId_fkey" FOREIGN KEY ("businessTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostingSetup" ADD CONSTRAINT "PostingSetup_productTaxGroupId_fkey" FOREIGN KEY ("productTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxPostingSetup" ADD CONSTRAINT "TaxPostingSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalPostingSetup" ADD CONSTRAINT "FiscalPostingSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalPostingSetup" ADD CONSTRAINT "FiscalPostingSetup_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "FiscalOperationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankLedgerEntry" ADD CONSTRAINT "BankLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankLedgerEntry" ADD CONSTRAINT "BankLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxLedgerEntry" ADD CONSTRAINT "TaxLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxLedgerEntry" ADD CONSTRAINT "TaxLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxLedgerEntry" ADD CONSTRAINT "TaxLedgerEntry_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxSettlementLedgerEntry" ADD CONSTRAINT "TaxSettlementLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxSettlementLedgerEntry" ADD CONSTRAINT "TaxSettlementLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
