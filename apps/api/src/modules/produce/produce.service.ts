import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, ProduceLotStatus, QualityInspectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import {
  CreateAgriculturalItemProfileDto,
  CreateDeliveryRouteDto,
  CreateInventoryLossEventDto,
  CreateInventoryLotDto,
  CreateLandedCostAllocationDto,
  CreatePackagingTypeDto,
  CreateQualityInspectionDto,
  CreateWarehouseDto,
  CreateWarehouseZoneDto,
} from './dto/produce.dto';

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class ProduceService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return ctx;
  }

  async summary() {
    const { tenantId } = this.ctx();
    const now = new Date();
    const sevenDays = new Date(now);
    sevenDays.setDate(sevenDays.getDate() + 7);
    const [
      profiles,
      lots,
      expiringLots,
      quarantinedLots,
      pendingInspections,
      losses,
      routes,
      warehouses,
    ] = await Promise.all([
      this.prisma.agriculturalItemProfile.count({ where: { tenantId } }),
      this.prisma.inventoryLot.count({ where: { tenantId } }),
      this.prisma.inventoryLot.count({
        where: {
          tenantId,
          status: ProduceLotStatus.AVAILABLE,
          expirationDate: { gte: now, lte: sevenDays },
        },
      }),
      this.prisma.inventoryLot.count({ where: { tenantId, status: ProduceLotStatus.QUARANTINED } }),
      this.prisma.qualityInspection.count({
        where: { tenantId, status: QualityInspectionStatus.PENDING },
      }),
      this.prisma.inventoryLossEvent.aggregate({
        where: { tenantId },
        _sum: { quantityKg: true, costImpact: true },
      }),
      this.prisma.deliveryRoute.count({ where: { tenantId } }),
      this.prisma.warehouse.count({ where: { tenantId } }),
    ]);

    return {
      profiles,
      lots,
      expiringLots,
      quarantinedLots,
      pendingInspections,
      routes,
      warehouses,
      totalLossKg: losses._sum.quantityKg ?? new Prisma.Decimal(0),
      totalLossCost: losses._sum.costImpact ?? new Prisma.Decimal(0),
      readinessWarnings: [
        profiles ? null : 'Sem perfis hortifruti para itens pereciveis.',
        lots ? null : 'Sem lotes para controle FEFO e validade.',
        warehouses ? null : 'Sem armazens/zonas para operacao de recebimento e separacao.',
      ].filter(Boolean),
    };
  }

  listProfiles() {
    const { tenantId } = this.ctx();
    return this.prisma.agriculturalItemProfile.findMany({
      where: { tenantId },
      orderBy: [{ productCategory: 'asc' }, { variety: 'asc' }],
      take: 200,
      include: { item: true, producer: true, defaultPackageType: true },
    });
  }

  createProfile(dto: CreateAgriculturalItemProfileDto) {
    const { tenantId } = this.ctx();
    this.assertCfop(dto.saleCfopDefault, 'CFOP padrao de venda');
    this.assertCfop(dto.purchaseCfopDefault, 'CFOP padrao de compra');
    return this.prisma.agriculturalItemProfile.create({
      data: {
        tenantId,
        itemId: dto.itemId,
        productCategory: dto.productCategory.trim(),
        agriculturalGroup: dto.agriculturalGroup,
        variety: dto.variety,
        producerPartyId: dto.producerPartyId,
        originRegion: dto.originRegion,
        defaultShelfLifeDays: dto.defaultShelfLifeDays,
        weightControlType: dto.weightControlType,
        packagingTareWeightKg: dto.packagingTareWeightKg,
        lotControlRequired: dto.lotControlRequired,
        fefoRequired: dto.fefoRequired,
        freshnessClass: dto.freshnessClass,
        defaultQualityGrade: dto.defaultQualityGrade,
        defaultPackageTypeId: dto.defaultPackageTypeId,
        saleCfopDefault: dto.saleCfopDefault,
        purchaseCfopDefault: dto.purchaseCfopDefault,
        agriculturalExemption: dto.agriculturalExemption,
        funruralApplicable: dto.funruralApplicable,
      },
    });
  }

  listPackaging() {
    const { tenantId } = this.ctx();
    return this.prisma.packagingType.findMany({
      where: { tenantId },
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
      take: 200,
    });
  }

  createPackaging(dto: CreatePackagingTypeDto) {
    const { tenantId } = this.ctx();
    return this.prisma.packagingType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        kind: dto.kind.trim().toUpperCase(),
        tareWeightKg: dto.tareWeightKg,
        capacityKg: dto.capacityKg,
        isReturnable: dto.isReturnable,
      },
    });
  }

  listWarehouses() {
    const { tenantId } = this.ctx();
    return this.prisma.warehouse.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
      include: { branch: true, zones: true },
    });
  }

  createWarehouse(dto: CreateWarehouseDto) {
    const { tenantId } = this.ctx();
    return this.prisma.warehouse.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        branchId: dto.branchId,
      },
    });
  }

  createWarehouseZone(dto: CreateWarehouseZoneDto) {
    const { tenantId } = this.ctx();
    return this.prisma.warehouseZone.create({
      data: {
        tenantId,
        warehouseId: dto.warehouseId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        type: dto.type,
        minTemperatureC: dto.minTemperatureC,
        maxTemperatureC: dto.maxTemperatureC,
      },
    });
  }

  listLots() {
    const { tenantId } = this.ctx();
    return this.prisma.inventoryLot.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { expirationDate: 'asc' }, { receivedDate: 'asc' }],
      take: 300,
      include: { item: true, warehouse: true, zone: true, producer: true, packageType: true },
    });
  }

  async createLot(dto: CreateInventoryLotDto) {
    const { tenantId } = this.ctx();
    const quantity = new Prisma.Decimal(dto.quantityKg);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Quantidade do lote deve ser maior que zero.');
    }
    const receivedDate = dto.receivedDate ? new Date(dto.receivedDate) : new Date();
    const expirationDate = dto.expirationDate
      ? new Date(dto.expirationDate)
      : this.expirationFromShelfLife(receivedDate, dto.shelfLifeDays);
    const costAmount = new Prisma.Decimal(dto.costAmount ?? '0');

    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const lot = await tx.inventoryLot.create({
        data: {
          tenantId,
          itemId: dto.itemId,
          lotNumber: dto.lotNumber.trim().toUpperCase(),
          warehouseId: dto.warehouseId,
          zoneId: dto.zoneId,
          producerPartyId: dto.producerPartyId,
          packageTypeId: dto.packageTypeId,
          packageCount: dto.packageCount,
          initialQuantityKg: quantity,
          quantityOnHandKg: quantity,
          harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : undefined,
          receivedDate,
          expirationDate,
          shelfLifeDays: dto.shelfLifeDays,
          qualityGrade: dto.qualityGrade,
          freshnessClass: dto.freshnessClass,
          originRegion: dto.originRegion,
        },
      });
      const valueEntry = costAmount.greaterThan(0)
        ? await tx.inventoryValueEntry.create({
            data: {
              tenantId,
              itemId: dto.itemId,
              lotId: lot.id,
              entryType: 'LOT_RECEIPT',
              quantity,
              costAmount,
              documentType: 'INVENTORY_LOT',
              documentId: lot.id,
            },
          })
        : null;
      await tx.itemLedgerEntry.create({
        data: {
          tenantId,
          itemId: dto.itemId,
          lotId: lot.id,
          warehouseId: dto.warehouseId,
          zoneId: dto.zoneId,
          valueEntryId: valueEntry?.id,
          quantity,
          entryType: 'LOT_RECEIPT',
          documentType: 'INVENTORY_LOT',
          documentId: lot.id,
        },
      });
      return lot;
    });
  }

  expirationRisk(days = 7) {
    const { tenantId } = this.ctx();
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + days);
    return this.prisma.inventoryLot.findMany({
      where: {
        tenantId,
        status: ProduceLotStatus.AVAILABLE,
        expirationDate: { lte: until },
        quantityOnHandKg: { gt: new Prisma.Decimal(0) },
      },
      orderBy: [{ expirationDate: 'asc' }, { receivedDate: 'asc' }],
      take: 200,
      include: { item: true, warehouse: true, zone: true },
    });
  }

  listInspections() {
    const { tenantId } = this.ctx();
    return this.prisma.qualityInspection.findMany({
      where: { tenantId },
      orderBy: { inspectionDate: 'desc' },
      take: 200,
      include: { item: true, lot: true, purchaseOrder: true },
    });
  }

  createInspection(dto: CreateQualityInspectionDto) {
    const { tenantId, userId } = this.ctx();
    return this.prisma.qualityInspection.create({
      data: {
        tenantId,
        itemId: dto.itemId,
        lotId: dto.lotId,
        purchaseOrderId: dto.purchaseOrderId,
        inspectorUserId: userId,
        status: dto.status,
        grade: dto.grade,
        freshnessClass: dto.freshnessClass,
        temperatureC: dto.temperatureC,
        brix: dto.brix,
        defects: dto.defects as Prisma.InputJsonValue | undefined,
        acceptedQuantityKg: dto.acceptedQuantityKg,
        rejectedQuantityKg: dto.rejectedQuantityKg,
        notes: dto.notes,
      },
    });
  }

  listLosses() {
    const { tenantId } = this.ctx();
    return this.prisma.inventoryLossEvent.findMany({
      where: { tenantId },
      orderBy: { postingDate: 'desc' },
      take: 200,
      include: { item: true, lot: true },
    });
  }

  async createLoss(dto: CreateInventoryLossEventDto) {
    const { tenantId, userId } = this.ctx();
    const quantity = new Prisma.Decimal(dto.quantityKg);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Quantidade de perda deve ser maior que zero.');
    }
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const lot = dto.lotId
        ? await tx.inventoryLot.findFirst({ where: { tenantId, id: dto.lotId } })
        : null;
      if (dto.lotId && !lot) {
        throw new BadRequestException('Lote invalido para o tenant.');
      }
      if (lot && new Prisma.Decimal(lot.quantityOnHandKg).lessThan(quantity)) {
        throw new BadRequestException('Perda maior que o saldo do lote.');
      }
      const loss = await tx.inventoryLossEvent.create({
        data: {
          tenantId,
          itemId: dto.itemId,
          lotId: dto.lotId,
          reason: dto.reason,
          quantityKg: quantity,
          costImpact: dto.costImpact ?? '0',
          createdById: userId,
          notes: dto.notes,
        },
      });
      if (lot) {
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: { quantityOnHandKg: new Prisma.Decimal(lot.quantityOnHandKg).minus(quantity) },
        });
      }
      const costImpact = new Prisma.Decimal(dto.costImpact ?? '0');
      const valueEntry = costImpact.greaterThan(0)
        ? await tx.inventoryValueEntry.create({
            data: {
              tenantId,
              itemId: dto.itemId,
              lotId: dto.lotId,
              entryType: `LOSS_${dto.reason}`,
              quantity: quantity.mul(-1),
              costAmount: costImpact.mul(-1),
              documentType: 'INVENTORY_LOSS',
              documentId: loss.id,
            },
          })
        : null;
      await tx.itemLedgerEntry.create({
        data: {
          tenantId,
          itemId: dto.itemId,
          lotId: dto.lotId,
          warehouseId: lot?.warehouseId,
          zoneId: lot?.zoneId,
          valueEntryId: valueEntry?.id,
          quantity: quantity.mul(-1),
          entryType: `LOSS_${dto.reason}`,
          documentType: 'INVENTORY_LOSS',
          documentId: loss.id,
        },
      });
      return loss;
    });
  }

  listLandedCosts() {
    const { tenantId } = this.ctx();
    return this.prisma.landedCostAllocation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { purchaseOrder: true },
    });
  }

  createLandedCost(dto: CreateLandedCostAllocationDto) {
    const { tenantId } = this.ctx();
    return this.prisma.landedCostAllocation.create({
      data: {
        tenantId,
        purchaseOrderId: dto.purchaseOrderId,
        basis: dto.basis,
        freightAmount: dto.freightAmount,
        handlingAmount: dto.handlingAmount,
        otherAmount: dto.otherAmount,
        totalWeightKg: dto.totalWeightKg,
      },
    });
  }

  listRoutes() {
    const { tenantId } = this.ctx();
    return this.prisma.deliveryRoute.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }],
      take: 100,
    });
  }

  createRoute(dto: CreateDeliveryRouteDto) {
    const { tenantId } = this.ctx();
    return this.prisma.deliveryRoute.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        status: dto.status,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        vehicleId: dto.vehicleId,
        driverName: dto.driverName,
        freightCost: dto.freightCost,
        stops: dto.stops as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private expirationFromShelfLife(receivedDate: Date, shelfLifeDays?: number) {
    if (!shelfLifeDays) return undefined;
    const date = new Date(receivedDate);
    date.setDate(date.getDate() + shelfLifeDays);
    return date;
  }

  private assertCfop(value: string | undefined, label: string) {
    if (value && !/^[123567]\d{3}$/.test(value)) {
      throw new BadRequestException(`${label} deve conter CFOP valido.`);
    }
  }
}
