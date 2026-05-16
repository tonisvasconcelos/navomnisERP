import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DeliveryRouteStatus,
  InventoryLossReason,
  LandedCostAllocationBasis,
  QualityInspectionStatus,
  WarehouseZoneType,
  WeightControlType,
} from '@prisma/client';

const decimalPattern = /^\d+(\.\d+)?$/;

export class CreateAgriculturalItemProfileDto {
  @IsUUID()
  itemId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  productCategory!: string;

  @IsOptional()
  @IsString()
  agriculturalGroup?: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsOptional()
  @IsUUID()
  producerPartyId?: string;

  @IsOptional()
  @IsString()
  originRegion?: string;

  @IsOptional()
  @Type(() => Number)
  defaultShelfLifeDays?: number;

  @IsOptional()
  @IsEnum(WeightControlType)
  weightControlType?: WeightControlType;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  packagingTareWeightKg?: string;

  @IsOptional()
  @IsBoolean()
  lotControlRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  fefoRequired?: boolean;

  @IsOptional()
  @IsString()
  freshnessClass?: string;

  @IsOptional()
  @IsString()
  defaultQualityGrade?: string;

  @IsOptional()
  @IsUUID()
  defaultPackageTypeId?: string;

  @IsOptional()
  @IsString()
  saleCfopDefault?: string;

  @IsOptional()
  @IsString()
  purchaseCfopDefault?: string;

  @IsOptional()
  @IsBoolean()
  agriculturalExemption?: boolean;

  @IsOptional()
  @IsBoolean()
  funruralApplicable?: boolean;
}

export class CreatePackagingTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  kind!: string;

  @IsString()
  @Matches(decimalPattern)
  tareWeightKg!: string;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  capacityKg?: string;

  @IsOptional()
  @IsBoolean()
  isReturnable?: boolean;
}

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateWarehouseZoneDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(WarehouseZoneType)
  type?: WarehouseZoneType;

  @IsOptional()
  @IsString()
  minTemperatureC?: string;

  @IsOptional()
  @IsString()
  maxTemperatureC?: string;
}

export class CreateInventoryLotDto {
  @IsUUID()
  itemId!: string;

  @IsString()
  lotNumber!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsUUID()
  producerPartyId?: string;

  @IsOptional()
  @IsUUID()
  packageTypeId?: string;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  packageCount?: string;

  @IsString()
  @Matches(decimalPattern)
  quantityKg!: string;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  costAmount?: string;

  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @Type(() => Number)
  shelfLifeDays?: number;

  @IsOptional()
  @IsString()
  qualityGrade?: string;

  @IsOptional()
  @IsString()
  freshnessClass?: string;

  @IsOptional()
  @IsString()
  originRegion?: string;
}

export class CreateQualityInspectionDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsEnum(QualityInspectionStatus)
  status?: QualityInspectionStatus;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  freshnessClass?: string;

  @IsOptional()
  @IsString()
  temperatureC?: string;

  @IsOptional()
  @IsString()
  brix?: string;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  acceptedQuantityKg?: string;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  rejectedQuantityKg?: string;

  @IsOptional()
  @IsObject()
  defects?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInventoryLossEventDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsEnum(InventoryLossReason)
  reason!: InventoryLossReason;

  @IsString()
  @Matches(decimalPattern)
  quantityKg!: string;

  @IsOptional()
  @IsString()
  @Matches(decimalPattern)
  costImpact?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateLandedCostAllocationDto {
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsEnum(LandedCostAllocationBasis)
  basis?: LandedCostAllocationBasis;

  @IsOptional()
  @IsString()
  freightAmount?: string;

  @IsOptional()
  @IsString()
  handlingAmount?: string;

  @IsOptional()
  @IsString()
  otherAmount?: string;

  @IsOptional()
  @IsString()
  totalWeightKg?: string;
}

export class CreateDeliveryRouteDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(DeliveryRouteStatus)
  status?: DeliveryRouteStatus;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  freightCost?: string;

  @IsOptional()
  @IsObject()
  stops?: Record<string, unknown>;
}
