import { ForbiddenException, Injectable } from '@nestjs/common';
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
      _sum: { quantity: true },
    });
    const items = await this.prisma.item.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { sku: 'asc' },
      take: 500,
    });
    const sumByItem = new Map(
      grouped.map((g) => [g.itemId, g._sum.quantity ?? new Prisma.Decimal(0)]),
    );
    return items.map((item) => ({
      itemId: item.id,
      sku: item.sku,
      name: item.name,
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
      include: { item: true },
    });
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
