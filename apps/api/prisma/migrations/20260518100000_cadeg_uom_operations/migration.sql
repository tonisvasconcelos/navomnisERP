-- CADEG: UOM, approvals, imports, purchase receipts

-- Extend DocumentStatus
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';

CREATE TYPE "UomKind" AS ENUM ('WEIGHT', 'COUNT', 'PACKAGE', 'BUNCH', 'TRAY', 'SACK', 'DOZEN', 'VOLUME', 'OTHER');
CREATE TYPE "UomRoundingMode" AS ENUM ('HALF_UP', 'HALF_DOWN', 'CEIL', 'FLOOR', 'NONE');
CREATE TYPE "ApprovalDocumentType" AS ENUM ('PURCHASE_ORDER', 'SALES_ORDER');
CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');
CREATE TYPE "ApprovalActionType" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL', 'ESCALATE');
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'PARSING', 'VALIDATING', 'READY_TO_COMMIT', 'COMMITTED', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'ERROR', 'SKIPPED', 'COMMITTED');

ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "baseUomId" TEXT;

ALTER TABLE "SalesOrderLine" ADD COLUMN IF NOT EXISTS "transactionUomId" TEXT;
ALTER TABLE "SalesOrderLine" ADD COLUMN IF NOT EXISTS "baseQuantity" DECIMAL(18,4);
ALTER TABLE "SalesOrderLine" ADD COLUMN IF NOT EXISTS "baseUomId" TEXT;
ALTER TABLE "SalesOrderLine" ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(18,8);
ALTER TABLE "SalesOrderLine" ADD COLUMN IF NOT EXISTS "conversionTrace" JSONB;
ALTER TABLE "SalesOrderLine" ADD COLUMN IF NOT EXISTS "packageCount" DECIMAL(18,4);

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "freightTerms" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "buyerNotes" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "transactionUomId" TEXT;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "baseQuantity" DECIMAL(18,4);
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "baseUomId" TEXT;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(18,8);
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "conversionTrace" JSONB;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "packageCount" DECIMAL(18,4);
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "receivedBaseQuantity" DECIMAL(18,4);
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "costUomId" TEXT;

ALTER TABLE "ItemLedgerEntry" ADD COLUMN IF NOT EXISTS "baseQuantity" DECIMAL(18,4);
ALTER TABLE "ItemLedgerEntry" ADD COLUMN IF NOT EXISTS "transactionUomId" TEXT;
ALTER TABLE "ItemLedgerEntry" ADD COLUMN IF NOT EXISTS "baseUomId" TEXT;
ALTER TABLE "ItemLedgerEntry" ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(18,8);
ALTER TABLE "ItemLedgerEntry" ADD COLUMN IF NOT EXISTS "conversionTrace" JSONB;

-- Backfill legacy rows
UPDATE "SalesOrderLine" SET "baseQuantity" = "quantity" WHERE "baseQuantity" IS NULL;
UPDATE "PurchaseOrderLine" SET "baseQuantity" = "quantity" WHERE "baseQuantity" IS NULL;
UPDATE "ItemLedgerEntry" SET "baseQuantity" = "quantity" WHERE "baseQuantity" IS NULL;
UPDATE "SalesOrderLine" SET "conversionFactor" = 1 WHERE "conversionFactor" IS NULL;
UPDATE "PurchaseOrderLine" SET "conversionFactor" = 1 WHERE "conversionFactor" IS NULL;
UPDATE "ItemLedgerEntry" SET "conversionFactor" = 1 WHERE "conversionFactor" IS NULL;

CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "UomKind" NOT NULL DEFAULT 'OTHER',
    "decimalScale" INTEGER NOT NULL DEFAULT 3,
    "isFiscalAllowed" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_code_key" ON "UnitOfMeasure"("tenantId", "code");
CREATE INDEX "UnitOfMeasure_tenantId_isActive_idx" ON "UnitOfMeasure"("tenantId", "isActive");

CREATE TABLE "UnitOfMeasureAlias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitOfMeasureAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnitOfMeasureAlias_tenantId_alias_key" ON "UnitOfMeasureAlias"("tenantId", "alias");

CREATE TABLE "ItemUomConversion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromUomId" TEXT NOT NULL,
    "toUomId" TEXT NOT NULL,
    "factor" DECIMAL(18,8) NOT NULL,
    "roundingMode" "UomRoundingMode" NOT NULL DEFAULT 'HALF_UP',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemUomConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemUomConversion_tenantId_itemId_fromUomId_toUomId_validFrom_key" ON "ItemUomConversion"("tenantId", "itemId", "fromUomId", "toUomId", "validFrom");

CREATE TABLE "SupplierItemUom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "purchaseUomId" TEXT NOT NULL,
    "unitsPerPack" DECIMAL(18,6),
    "minOrderQty" DECIMAL(18,4),
    "leadTimeDays" INTEGER,
    "preferredCostUomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierItemUom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierItemUom_tenantId_supplierId_itemId_key" ON "SupplierItemUom"("tenantId", "supplierId", "itemId");

CREATE TABLE "CustomerItemUom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "customerSku" TEXT,
    "saleUomId" TEXT NOT NULL,
    "priceUomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerItemUom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerItemUom_tenantId_customerId_itemId_key" ON "CustomerItemUom"("tenantId", "customerId", "itemId");

CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "documentType" "ApprovalDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minAmount" DECIMAL(18,2),
    "maxAmount" DECIMAL(18,2),
    "vendorId" TEXT,
    "categoryCode" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalPolicyStep" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "approverRoleId" TEXT,
    "approverUserId" TEXT,
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "escalationHours" INTEGER,
    CONSTRAINT "ApprovalPolicyStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentType" "ApprovalDocumentType" NOT NULL,
    "documentId" TEXT NOT NULL,
    "policyId" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalInstance_tenantId_documentType_documentId_key" ON "ApprovalInstance"("tenantId", "documentType", "documentId");

CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouseId" TEXT,
    "zoneId" TEXT,
    "receivedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "transactionQuantity" DECIMAL(18,4) NOT NULL,
    "baseQuantity" DECIMAL(18,4) NOT NULL,
    "lotId" TEXT,
    "qualityInspectionId" TEXT,
    CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandedCostAllocationLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "freightAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "handlingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT "LandedCostAllocationLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'legacy_erp',
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "encoding" TEXT NOT NULL DEFAULT 'cp1252',
    "delimiter" TEXT NOT NULL DEFAULT ';',
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "idempotencyKey" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportBatch_tenantId_idempotencyKey_key" ON "ImportBatch"("tenantId", "idempotencyKey");

CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "matchedItemId" TEXT,
    "matchedPartyId" TEXT,
    "resolvedUomId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportRow_batchId_idempotencyKey_key" ON "ImportRow"("batchId", "idempotencyKey");

CREATE TABLE "UomConversionException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT,
    "context" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UomConversionException_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (abbreviated - add via Prisma on deploy)
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_baseUomId_fkey" FOREIGN KEY ("baseUomId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalPolicyStep" ADD CONSTRAINT "ApprovalPolicyStep_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ApprovalInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
