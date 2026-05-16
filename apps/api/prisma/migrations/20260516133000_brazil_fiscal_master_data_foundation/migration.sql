-- Brazilian fiscal master-data foundation.
-- Additive migration: configurable product/service templates, company/branch fiscal
-- profiles, customer/vendor fiscal extensions, and payroll tax master data.

CREATE TYPE "FiscalRegisterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "ItemFiscalType" AS ENUM ('MERCHANDISE', 'RAW_MATERIAL', 'FINISHED_GOOD', 'FIXED_ASSET', 'CONSUMABLE', 'FUEL', 'IMPORTED', 'SERVICE_BUNDLE', 'OTHER');
CREATE TYPE "ServiceFiscalType" AS ENUM ('SERVICE', 'COMMUNICATION', 'TRANSPORT', 'CONSTRUCTION', 'DIGITAL', 'PUBLIC_SERVICE', 'OTHER');
CREATE TYPE "LaborRegime" AS ENUM ('CLT', 'STATUTORY', 'APPRENTICE', 'INTERN', 'CONTRACTOR', 'DIRECTOR', 'TEMPORARY', 'OTHER');

ALTER TABLE "Item" ADD COLUMN "itemFiscalTemplateId" TEXT;

ALTER TABLE "PartyFiscalProfile"
  ADD COLUMN "contributorType" TEXT,
  ADD COLUMN "consumerFinal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultOperationTypeCode" TEXT,
  ADD COLUMN "retentionRules" JSONB,
  ADD COLUMN "serviceRetentionRules" JSONB,
  ADD COLUMN "withholdingObligations" JSONB,
  ADD COLUMN "creditTaxPolicy" JSONB,
  ADD COLUMN "recoverableTaxPolicy" JSONB;

CREATE TABLE "ItemFiscalTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "FiscalRegisterStatus" NOT NULL DEFAULT 'DRAFT',
  "ncm" TEXT,
  "cest" TEXT,
  "exTipi" TEXT,
  "productOrigin" TEXT,
  "fiscalCategory" TEXT,
  "fiscalType" "ItemFiscalType" NOT NULL DEFAULT 'MERCHANDISE',
  "taxGroupId" TEXT,
  "fiscalBenefitCode" TEXT,
  "spedClassification" TEXT,
  "icmsCst" TEXT,
  "csosn" TEXT,
  "icmsAliquot" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "icmsReduction" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "icmsDeferred" BOOLEAN NOT NULL DEFAULT false,
  "icmsExemption" BOOLEAN NOT NULL DEFAULT false,
  "icmsBaseReduction" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "icmsStRuleCode" TEXT,
  "mva" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "fcpRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "fcpStRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "difalRuleCode" TEXT,
  "interstateRuleCode" TEXT,
  "internalRuleCode" TEXT,
  "ipiCst" TEXT,
  "ipiEnquadramento" TEXT,
  "ipiRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipiExemption" BOOLEAN NOT NULL DEFAULT false,
  "pisCst" TEXT,
  "cofinsCst" TEXT,
  "pisRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "cofinsRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "monophase" BOOLEAN NOT NULL DEFAULT false,
  "pisCofinsSt" BOOLEAN NOT NULL DEFAULT false,
  "fiscalUom" TEXT,
  "commercialUom" TEXT,
  "conversionFactor" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "lotFiscalControl" BOOLEAN NOT NULL DEFAULT false,
  "traceability" BOOLEAN NOT NULL DEFAULT false,
  "ibsCategory" TEXT,
  "cbsCategory" TEXT,
  "futureVatClassification" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ItemFiscalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceFiscalTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "FiscalRegisterStatus" NOT NULL DEFAULT 'DRAFT',
  "serviceType" "ServiceFiscalType" NOT NULL DEFAULT 'SERVICE',
  "cnae" TEXT,
  "municipalServiceCode" TEXT,
  "lc116ServiceCode" TEXT,
  "fiscalServiceCategory" TEXT,
  "taxGroupId" TEXT,
  "issRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "issMunicipalityCode" TEXT,
  "issRetention" BOOLEAN NOT NULL DEFAULT false,
  "issResponsibleParty" TEXT,
  "issExemption" BOOLEAN NOT NULL DEFAULT false,
  "irrfRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "csllRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "pisRetentionRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "cofinsRetentionRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "inssRetentionRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "municipalityOfIncidence" TEXT,
  "taxMunicipalityCode" TEXT,
  "serviceLocationRule" TEXT,
  "interstateServiceRule" TEXT,
  "publicAgencyRule" TEXT,
  "ibsServiceClassification" TEXT,
  "cbsServiceClassification" TEXT,
  "futureTransitionRule" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceFiscalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyFiscalProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "status" "FiscalRegisterStatus" NOT NULL DEFAULT 'DRAFT',
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "cnpj" TEXT NOT NULL,
  "stateRegistration" TEXT,
  "municipalRegistration" TEXT,
  "mainCnae" TEXT,
  "secondaryCnaes" JSONB,
  "fiscalRegime" "BrazilianFiscalRegime" NOT NULL,
  "simplesOption" BOOLEAN NOT NULL DEFAULT false,
  "taxStartDate" TIMESTAMP(3),
  "taxTransitionDate" TIMESTAMP(3),
  "spedProfile" TEXT,
  "obligations" JSONB,
  "defaultBusinessTaxGroupId" TEXT,
  "defaultProductTaxGroupId" TEXT,
  "defaultOperationTypeCode" TEXT,
  "ibsRegistration" TEXT,
  "cbsRegistration" TEXT,
  "futureFiscalIdentifiers" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyFiscalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Branch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isHeadquarter" BOOLEAN NOT NULL DEFAULT false,
  "cnpj" TEXT NOT NULL,
  "stateRegistration" TEXT,
  "municipalRegistration" TEXT,
  "fiscalJurisdictionId" TEXT,
  "taxState" TEXT,
  "taxMunicipalityCode" TEXT,
  "address" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchFiscalProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "FiscalRegisterStatus" NOT NULL DEFAULT 'DRAFT',
  "fiscalJurisdictionId" TEXT,
  "taxState" TEXT,
  "taxMunicipalityCode" TEXT,
  "obligations" JSONB,
  "localFiscalRules" JSONB,
  "defaultBusinessTaxGroupId" TEXT,
  "defaultProductTaxGroupId" TEXT,
  "defaultOperationTypeCode" TEXT,
  "postingSetup" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BranchFiscalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "code" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "pisPasep" TEXT,
  "esocialRegistration" TEXT,
  "esocialCategory" TEXT,
  "laborRegime" "LaborRegime" NOT NULL DEFAULT 'CLT',
  "department" TEXT,
  "costCenter" TEXT,
  "taxMunicipalityCode" TEXT,
  "hireDate" TIMESTAMP(3),
  "terminationDate" TIMESTAMP(3),
  "status" "FiscalRegisterStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeTaxProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "inssCategory" TEXT,
  "fgtsCategory" TEXT,
  "irrfCategory" TEXT,
  "unionContribution" BOOLEAN NOT NULL DEFAULT false,
  "ratRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "fapRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "payrollTaxGroupId" TEXT,
  "esocialEventMapping" JSONB,
  "laborObligations" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeTaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemFiscalTemplate_tenantId_code_effectiveFrom_key" ON "ItemFiscalTemplate"("tenantId", "code", "effectiveFrom");
CREATE INDEX "ItemFiscalTemplate_tenantId_ncm_cest_idx" ON "ItemFiscalTemplate"("tenantId", "ncm", "cest");
CREATE INDEX "ItemFiscalTemplate_tenantId_status_effectiveFrom_effectiveTo_idx" ON "ItemFiscalTemplate"("tenantId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "ItemFiscalTemplate_tenantId_taxGroupId_idx" ON "ItemFiscalTemplate"("tenantId", "taxGroupId");

CREATE UNIQUE INDEX "ServiceFiscalTemplate_tenantId_code_effectiveFrom_key" ON "ServiceFiscalTemplate"("tenantId", "code", "effectiveFrom");
CREATE INDEX "ServiceFiscalTemplate_tenantId_serviceType_status_idx" ON "ServiceFiscalTemplate"("tenantId", "serviceType", "status");
CREATE INDEX "ServiceFiscalTemplate_tenantId_cnae_lc116ServiceCode_idx" ON "ServiceFiscalTemplate"("tenantId", "cnae", "lc116ServiceCode");
CREATE INDEX "ServiceFiscalTemplate_tenantId_taxGroupId_idx" ON "ServiceFiscalTemplate"("tenantId", "taxGroupId");

CREATE UNIQUE INDEX "CompanyFiscalProfile_companyId_validFrom_key" ON "CompanyFiscalProfile"("companyId", "validFrom");
CREATE INDEX "CompanyFiscalProfile_tenantId_cnpj_idx" ON "CompanyFiscalProfile"("tenantId", "cnpj");
CREATE INDEX "CompanyFiscalProfile_tenantId_fiscalRegime_status_idx" ON "CompanyFiscalProfile"("tenantId", "fiscalRegime", "status");
CREATE INDEX "CompanyFiscalProfile_tenantId_validFrom_validTo_idx" ON "CompanyFiscalProfile"("tenantId", "validFrom", "validTo");

CREATE UNIQUE INDEX "Branch_tenantId_companyId_code_key" ON "Branch"("tenantId", "companyId", "code");
CREATE INDEX "Branch_tenantId_cnpj_idx" ON "Branch"("tenantId", "cnpj");
CREATE INDEX "Branch_tenantId_companyId_isActive_idx" ON "Branch"("tenantId", "companyId", "isActive");
CREATE INDEX "Branch_tenantId_fiscalJurisdictionId_idx" ON "Branch"("tenantId", "fiscalJurisdictionId");

CREATE UNIQUE INDEX "BranchFiscalProfile_branchId_validFrom_key" ON "BranchFiscalProfile"("branchId", "validFrom");
CREATE INDEX "BranchFiscalProfile_tenantId_branchId_status_idx" ON "BranchFiscalProfile"("tenantId", "branchId", "status");
CREATE INDEX "BranchFiscalProfile_tenantId_fiscalJurisdictionId_idx" ON "BranchFiscalProfile"("tenantId", "fiscalJurisdictionId");
CREATE INDEX "BranchFiscalProfile_tenantId_validFrom_validTo_idx" ON "BranchFiscalProfile"("tenantId", "validFrom", "validTo");

CREATE UNIQUE INDEX "Employee_tenantId_code_key" ON "Employee"("tenantId", "code");
CREATE INDEX "Employee_tenantId_cpf_idx" ON "Employee"("tenantId", "cpf");
CREATE INDEX "Employee_tenantId_companyId_branchId_idx" ON "Employee"("tenantId", "companyId", "branchId");
CREATE INDEX "Employee_tenantId_status_idx" ON "Employee"("tenantId", "status");

CREATE UNIQUE INDEX "EmployeeTaxProfile_employeeId_validFrom_key" ON "EmployeeTaxProfile"("employeeId", "validFrom");
CREATE INDEX "EmployeeTaxProfile_tenantId_employeeId_validFrom_validTo_idx" ON "EmployeeTaxProfile"("tenantId", "employeeId", "validFrom", "validTo");
CREATE INDEX "EmployeeTaxProfile_tenantId_payrollTaxGroupId_idx" ON "EmployeeTaxProfile"("tenantId", "payrollTaxGroupId");

CREATE INDEX "Item_tenantId_itemFiscalTemplateId_idx" ON "Item"("tenantId", "itemFiscalTemplateId");

ALTER TABLE "Item" ADD CONSTRAINT "Item_itemFiscalTemplateId_fkey" FOREIGN KEY ("itemFiscalTemplateId") REFERENCES "ItemFiscalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemFiscalTemplate" ADD CONSTRAINT "ItemFiscalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemFiscalTemplate" ADD CONSTRAINT "ItemFiscalTemplate_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceFiscalTemplate" ADD CONSTRAINT "ServiceFiscalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceFiscalTemplate" ADD CONSTRAINT "ServiceFiscalTemplate_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyFiscalProfile" ADD CONSTRAINT "CompanyFiscalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyFiscalProfile" ADD CONSTRAINT "CompanyFiscalProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyFiscalProfile" ADD CONSTRAINT "CompanyFiscalProfile_defaultBusinessTaxGroupId_fkey" FOREIGN KEY ("defaultBusinessTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyFiscalProfile" ADD CONSTRAINT "CompanyFiscalProfile_defaultProductTaxGroupId_fkey" FOREIGN KEY ("defaultProductTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_fiscalJurisdictionId_fkey" FOREIGN KEY ("fiscalJurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BranchFiscalProfile" ADD CONSTRAINT "BranchFiscalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchFiscalProfile" ADD CONSTRAINT "BranchFiscalProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchFiscalProfile" ADD CONSTRAINT "BranchFiscalProfile_fiscalJurisdictionId_fkey" FOREIGN KEY ("fiscalJurisdictionId") REFERENCES "FiscalJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchFiscalProfile" ADD CONSTRAINT "BranchFiscalProfile_defaultBusinessTaxGroupId_fkey" FOREIGN KEY ("defaultBusinessTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchFiscalProfile" ADD CONSTRAINT "BranchFiscalProfile_defaultProductTaxGroupId_fkey" FOREIGN KEY ("defaultProductTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_payrollTaxGroupId_fkey" FOREIGN KEY ("payrollTaxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
