import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import type { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listItems() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return this.prisma.item.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async balances() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    const grouped = await this.prisma.itemLedgerEntry.groupBy({
      by: ['itemId'],
      where: { tenantId: ctx.tenantId },
      _sum: { baseQuantity: true, quantity: true },
    });
    const items = await this.prisma.item.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { sku: 'asc' },
      take: 500,
      include: { baseUomRef: true },
    });
    const sumByItem = new Map(
      grouped.map((g) => [
        g.itemId,
        g._sum.baseQuantity ?? g._sum.quantity ?? new Prisma.Decimal(0),
      ]),
    );
    return items.map((item) => ({
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      baseUom: item.baseUomRef?.code ?? item.baseUom,
      quantityOnHand: sumByItem.get(item.id) ?? new Prisma.Decimal(0),
    }));
  }

  ledger() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return this.prisma.itemLedgerEntry.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { postingDate: 'desc' },
      take: 200,
      include: {
        item: true,
        transactionUom: true,
        baseUom: true,
        lot: true,
        warehouse: true,
      },
    });
  }

  async getItemDetail(itemId: string) {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    const { tenantId } = ctx;

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, tenantId },
      include: { baseUomRef: true },
    });
    if (!item) throw new NotFoundException('Artigo não encontrado.');

    const [ledgerAgg, recentLedger, conversions, supplierUoms, customerUoms, openLots, primaryMedia, valueEntries] =
      await Promise.all([
        this.prisma.itemLedgerEntry.aggregate({
          where: { tenantId, itemId },
          _sum: { baseQuantity: true, quantity: true },
        }),
        this.prisma.itemLedgerEntry.findMany({
          where: { tenantId, itemId },
          orderBy: { postingDate: 'desc' },
          take: 20,
          include: {
            transactionUom: true,
            baseUom: true,
            lot: true,
            warehouse: true,
            zone: true,
          },
        }),
        this.prisma.itemUomConversion.findMany({
          where: { tenantId, itemId },
          include: { fromUom: true, toUom: true },
          orderBy: { validFrom: 'desc' },
        }),
        this.prisma.supplierItemUom.findMany({
          where: { tenantId, itemId },
          include: { supplier: true, purchaseUom: true, preferredCostUom: true },
        }),
        this.prisma.customerItemUom.findMany({
          where: { tenantId, itemId },
          include: { customer: true, saleUom: true, priceUom: true },
        }),
        this.prisma.inventoryLot.findMany({
          where: { tenantId, itemId, quantityOnHandKg: { gt: 0 } },
          orderBy: [{ expirationDate: 'asc' }, { receivedDate: 'asc' }],
          take: 50,
          include: { warehouse: true, zone: true },
        }),
        this.prisma.itemMedia.findFirst({
          where: { tenantId, itemId, isPrimary: true },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.inventoryValueEntry.findMany({
          where: { tenantId, itemId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    const quantityOnHand =
      ledgerAgg._sum.baseQuantity ?? ledgerAgg._sum.quantity ?? new Prisma.Decimal(0);

    const totalCost = valueEntries.reduce(
      (acc, v) => acc.add(v.costAmount),
      new Prisma.Decimal(0),
    );

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      isActive: item.isActive,
      baseUom: item.baseUomRef
        ? { id: item.baseUomRef.id, code: item.baseUomRef.code, name: item.baseUomRef.name }
        : { code: item.baseUom, name: item.baseUom },
      primaryImageUrl: primaryMedia?.url ?? null,
      quantityOnHand,
      recentLedger,
      uomConversions: conversions,
      supplierItemUoms: supplierUoms,
      customerItemUoms: customerUoms,
      openLots,
      valueSummary: {
        recentEntryCount: valueEntries.length,
        totalCostAmount: totalCost,
      },
    };
  }

  async createItem(dto: CreateItemDto, req?: Request) {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    const item = await this.prisma.item.create({
      data: {
        tenantId: ctx.tenantId,
        sku: dto.sku,
        name: dto.name,
        baseUom: dto.baseUom,
      },
    });
    await this.audit.logMutation({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: 'item.create',
      entityType: 'Item',
      entityId: item.id,
      metadata: { sku: item.sku },
      req,
    });
    return item;
  }
}
