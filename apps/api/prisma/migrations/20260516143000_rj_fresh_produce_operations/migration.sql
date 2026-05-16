-- Rio de Janeiro fresh-produce operations foundation.
-- Additive migration for weighted products, perishability, lot/FEFO control,
-- quality inspection, landed cost, shrink/spoilage, warehouse zones, and routes.

CREATE TYPE "WeightControlType" AS ENUM ('FIXED_QUANTITY', 'VARIABLE_WEIGHT', 'CATCH_WEIGHT');
CREATE TYPE "WarehouseZoneType" AS ENUM ('AMBIENT', 'COLD_ROOM', 'RIPENING', 'RECEIVING', 'PICKING', 'EXPEDITION', 'QUARANTINE', 'WASTE');
CREATE TYPE "ProduceLotStatus" AS ENUM ('AVAILABLE', 'QUARANTINED', 'RESERVED', 'EXPIRED', 'CONSUMED', 'DISCARDED');
CREATE TYPE "QualityInspectionStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED');
CREATE TYPE "InventoryLossReason" AS ENUM ('SPOILAGE', 'SHRINKAGE', 'DAMAGE', 'QUALITY_RECLASSIFICATION', 'WEIGHT_VARIANCE', 'THEFT', 'OTHER');
CREATE TYPE "DeliveryRouteStatus" AS ENUM ('PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
CREATE TYPE "LandedCostAllocationBasis" AS ENUM ('WEIGHT', 'VALUE', 'QUANTITY', 'MANUAL');

ALTER TABLE "SalesOrderLine"
  ADD COLUMN "lotId" TEXT,
  ADD COLUMN "packageTypeId" TEXT,
  ADD COLUMN "grossWeightKg" DECIMAL(18,4),
  ADD COLUMN "tareWeightKg" DECIMAL(18,4),
  ADD COLUMN "netWeightKg" DECIMAL(18,4),
  ADD COLUMN "qualityGrade" TEXT;

ALTER TABLE "PurchaseOrderLine"
  ADD COLUMN "lotId" TEXT,
  ADD COLUMN "packageTypeId" TEXT,
  ADD COLUMN "grossWeightKg" DECIMAL(18,4),
  ADD COLUMN "tareWeightKg" DECIMAL(18,4),
  ADD COLUMN "netWeightKg" DECIMAL(18,4),
  ADD COLUMN "qualityGrade" TEXT,
  ADD COLUMN "freightCostAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "handlingCostAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "landedCostAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "ItemLedgerEntry"
  ADD COLUMN "lotId" TEXT,
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "zoneId" TEXT,
  ADD COLUMN "valueEntryId" TEXT;

CREATE TABLE "AgriculturalItemProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "productCategory" TEXT NOT NULL,
  "agriculturalGroup" TEXT,
  "variety" TEXT,
  "producerPartyId" TEXT,
  "originRegion" TEXT,
  "harvestInfo" JSONB,
  "seasonality" JSONB,
  "defaultShelfLifeDays" INTEGER,
  "weightControlType" "WeightControlType" NOT NULL DEFAULT 'VARIABLE_WEIGHT',
  "packagingTareWeightKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "grossWeightRequired" BOOLEAN NOT NULL DEFAULT true,
  "scaleIntegrationCode" TEXT,
  "lotControlRequired" BOOLEAN NOT NULL DEFAULT true,
  "fefoRequired" BOOLEAN NOT NULL DEFAULT true,
  "freshnessClass" TEXT,
  "defaultQualityGrade" TEXT,
  "defaultPackageTypeId" TEXT,
  "saleCfopDefault" TEXT,
  "purchaseCfopDefault" TEXT,
  "agriculturalBenefitCode" TEXT,
  "agriculturalExemption" BOOLEAN NOT NULL DEFAULT false,
  "ruralProducerTaxScenario" TEXT,
  "funruralApplicable" BOOLEAN NOT NULL DEFAULT false,
  "ibsCategory" TEXT,
  "cbsCategory" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgriculturalItemProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PackagingType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "tareWeightKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "capacityKg" DECIMAL(18,4),
  "isReturnable" BOOLEAN NOT NULL DEFAULT false,
  "depositAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackagingType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "branchId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseZone" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WarehouseZoneType" NOT NULL DEFAULT 'AMBIENT',
  "minTemperatureC" DECIMAL(6,2),
  "maxTemperatureC" DECIMAL(6,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL,
  "warehouseId" TEXT,
  "zoneId" TEXT,
  "producerPartyId" TEXT,
  "packageTypeId" TEXT,
  "packageCount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "initialQuantityKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "quantityOnHandKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "harvestDate" TIMESTAMP(3),
  "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expirationDate" TIMESTAMP(3),
  "shelfLifeDays" INTEGER,
  "qualityGrade" TEXT,
  "freshnessClass" TEXT,
  "originRegion" TEXT,
  "status" "ProduceLotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QualityInspection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "lotId" TEXT,
  "purchaseOrderId" TEXT,
  "inspectorUserId" TEXT,
  "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "QualityInspectionStatus" NOT NULL DEFAULT 'PENDING',
  "grade" TEXT,
  "freshnessClass" TEXT,
  "temperatureC" DECIMAL(6,2),
  "brix" DECIMAL(6,2),
  "defects" JSONB,
  "acceptedQuantityKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "rejectedQuantityKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLossEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "lotId" TEXT,
  "reason" "InventoryLossReason" NOT NULL,
  "quantityKg" DECIMAL(18,4) NOT NULL,
  "costImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentType" TEXT,
  "documentId" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryLossEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryValueEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "lotId" TEXT,
  "entryType" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "costAmount" DECIMAL(18,2) NOT NULL,
  "expectedCostAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "documentType" TEXT,
  "documentId" TEXT,
  "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryValueEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandedCostAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "basis" "LandedCostAllocationBasis" NOT NULL DEFAULT 'WEIGHT',
  "freightAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "handlingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalWeightKg" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "allocationTrace" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LandedCostAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryRoute" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "DeliveryRouteStatus" NOT NULL DEFAULT 'PLANNED',
  "scheduledDate" TIMESTAMP(3),
  "vehicleId" TEXT,
  "driverName" TEXT,
  "freightCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "customerWindows" JSONB,
  "stops" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgriculturalItemProfile_itemId_key" ON "AgriculturalItemProfile"("itemId");
CREATE INDEX "AgriculturalItemProfile_tenantId_productCategory_agriculturalGroup_idx" ON "AgriculturalItemProfile"("tenantId", "productCategory", "agriculturalGroup");
CREATE INDEX "AgriculturalItemProfile_tenantId_producerPartyId_idx" ON "AgriculturalItemProfile"("tenantId", "producerPartyId");
CREATE INDEX "AgriculturalItemProfile_tenantId_weightControlType_lotControlRequired_fefoRequired_idx" ON "AgriculturalItemProfile"("tenantId", "weightControlType", "lotControlRequired", "fefoRequired");
CREATE INDEX "AgriculturalItemProfile_tenantId_effectiveFrom_effectiveTo_idx" ON "AgriculturalItemProfile"("tenantId", "effectiveFrom", "effectiveTo");

CREATE UNIQUE INDEX "PackagingType_tenantId_code_key" ON "PackagingType"("tenantId", "code");
CREATE INDEX "PackagingType_tenantId_kind_isActive_idx" ON "PackagingType"("tenantId", "kind", "isActive");

CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");
CREATE INDEX "Warehouse_tenantId_branchId_isActive_idx" ON "Warehouse"("tenantId", "branchId", "isActive");

CREATE UNIQUE INDEX "WarehouseZone_tenantId_warehouseId_code_key" ON "WarehouseZone"("tenantId", "warehouseId", "code");
CREATE INDEX "WarehouseZone_tenantId_type_isActive_idx" ON "WarehouseZone"("tenantId", "type", "isActive");

CREATE UNIQUE INDEX "InventoryLot_tenantId_itemId_lotNumber_key" ON "InventoryLot"("tenantId", "itemId", "lotNumber");
CREATE INDEX "InventoryLot_tenantId_itemId_status_expirationDate_idx" ON "InventoryLot"("tenantId", "itemId", "status", "expirationDate");
CREATE INDEX "InventoryLot_tenantId_warehouseId_zoneId_status_idx" ON "InventoryLot"("tenantId", "warehouseId", "zoneId", "status");
CREATE INDEX "InventoryLot_tenantId_producerPartyId_receivedDate_idx" ON "InventoryLot"("tenantId", "producerPartyId", "receivedDate");

CREATE INDEX "QualityInspection_tenantId_itemId_inspectionDate_idx" ON "QualityInspection"("tenantId", "itemId", "inspectionDate");
CREATE INDEX "QualityInspection_tenantId_lotId_status_idx" ON "QualityInspection"("tenantId", "lotId", "status");
CREATE INDEX "QualityInspection_tenantId_purchaseOrderId_idx" ON "QualityInspection"("tenantId", "purchaseOrderId");

CREATE INDEX "InventoryLossEvent_tenantId_itemId_postingDate_idx" ON "InventoryLossEvent"("tenantId", "itemId", "postingDate");
CREATE INDEX "InventoryLossEvent_tenantId_lotId_reason_idx" ON "InventoryLossEvent"("tenantId", "lotId", "reason");

CREATE INDEX "InventoryValueEntry_tenantId_itemId_postingDate_idx" ON "InventoryValueEntry"("tenantId", "itemId", "postingDate");
CREATE INDEX "InventoryValueEntry_tenantId_lotId_postingDate_idx" ON "InventoryValueEntry"("tenantId", "lotId", "postingDate");
CREATE INDEX "InventoryValueEntry_tenantId_documentType_documentId_idx" ON "InventoryValueEntry"("tenantId", "documentType", "documentId");

CREATE INDEX "LandedCostAllocation_tenantId_purchaseOrderId_status_idx" ON "LandedCostAllocation"("tenantId", "purchaseOrderId", "status");

CREATE UNIQUE INDEX "DeliveryRoute_tenantId_code_key" ON "DeliveryRoute"("tenantId", "code");
CREATE INDEX "DeliveryRoute_tenantId_status_scheduledDate_idx" ON "DeliveryRoute"("tenantId", "status", "scheduledDate");

CREATE INDEX "SalesOrderLine_lotId_idx" ON "SalesOrderLine"("lotId");
CREATE INDEX "PurchaseOrderLine_lotId_idx" ON "PurchaseOrderLine"("lotId");
CREATE INDEX "ItemLedgerEntry_tenantId_lotId_postingDate_idx" ON "ItemLedgerEntry"("tenantId", "lotId", "postingDate");
CREATE INDEX "ItemLedgerEntry_tenantId_warehouseId_zoneId_idx" ON "ItemLedgerEntry"("tenantId", "warehouseId", "zoneId");

ALTER TABLE "AgriculturalItemProfile" ADD CONSTRAINT "AgriculturalItemProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgriculturalItemProfile" ADD CONSTRAINT "AgriculturalItemProfile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgriculturalItemProfile" ADD CONSTRAINT "AgriculturalItemProfile_producerPartyId_fkey" FOREIGN KEY ("producerPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgriculturalItemProfile" ADD CONSTRAINT "AgriculturalItemProfile_defaultPackageTypeId_fkey" FOREIGN KEY ("defaultPackageTypeId") REFERENCES "PackagingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackagingType" ADD CONSTRAINT "PackagingType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_producerPartyId_fkey" FOREIGN KEY ("producerPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_packageTypeId_fkey" FOREIGN KEY ("packageTypeId") REFERENCES "PackagingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_inspectorUserId_fkey" FOREIGN KEY ("inspectorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryLossEvent" ADD CONSTRAINT "InventoryLossEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLossEvent" ADD CONSTRAINT "InventoryLossEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLossEvent" ADD CONSTRAINT "InventoryLossEvent_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryLossEvent" ADD CONSTRAINT "InventoryLossEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryValueEntry" ADD CONSTRAINT "InventoryValueEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryValueEntry" ADD CONSTRAINT "InventoryValueEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryValueEntry" ADD CONSTRAINT "InventoryValueEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LandedCostAllocation" ADD CONSTRAINT "LandedCostAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandedCostAllocation" ADD CONSTRAINT "LandedCostAllocation_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_packageTypeId_fkey" FOREIGN KEY ("packageTypeId") REFERENCES "PackagingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_packageTypeId_fkey" FOREIGN KEY ("packageTypeId") REFERENCES "PackagingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemLedgerEntry" ADD CONSTRAINT "ItemLedgerEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemLedgerEntry" ADD CONSTRAINT "ItemLedgerEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemLedgerEntry" ADD CONSTRAINT "ItemLedgerEntry_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemLedgerEntry" ADD CONSTRAINT "ItemLedgerEntry_valueEntryId_fkey" FOREIGN KEY ("valueEntryId") REFERENCES "InventoryValueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
