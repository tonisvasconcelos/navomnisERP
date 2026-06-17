import { ForbiddenException, Injectable } from '@nestjs/common';
import { DocumentStatus, Prisma, ProduceLotStatus, QualityInspectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = getTenantContext();
    if (!c) throw new ForbiddenException('Contexto de tenant ausente.');
    return c;
  }

  async operationsSummary() {
    const { tenantId } = this.ctx();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [salesToday, openPos, uomExceptions, expiringLots] = await Promise.all([
      this.prisma.salesOrder.aggregate({
        where: { tenantId, orderDate: { gte: today }, status: { not: DocumentStatus.CANCELLED } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.purchaseOrder.count({
        where: {
          tenantId,
          status: { in: [DocumentStatus.OPEN, DocumentStatus.RELEASED, DocumentStatus.APPROVED] },
        },
      }),
      this.prisma.uomConversionException.count({ where: { tenantId, resolved: false } }),
      this.prisma.inventoryLot.count({
        where: {
          tenantId,
          status: ProduceLotStatus.AVAILABLE,
          expirationDate: {
            lte: new Date(Date.now() + 7 * 86400000),
            gte: new Date(),
          },
        },
      }),
    ]);
    return {
      salesTodayAmount: salesToday._sum.totalAmount ?? new Prisma.Decimal(0),
      salesTodayCount: salesToday._count,
      openPurchaseOrders: openPos,
      uomExceptionCount: uomExceptions,
      expiringLots7d: expiringLots,
    };
  }

  async marginByDimension(dim: string) {
    const { tenantId } = this.ctx();
    const lines = await this.prisma.salesOrderLine.findMany({
      where: { order: { tenantId, status: { not: DocumentStatus.CANCELLED } } },
      include: {
        item: true,
        order: { include: { customer: true } },
      },
      take: 5000,
    });
    const buckets = new Map<string, { revenue: Prisma.Decimal; cost: Prisma.Decimal }>();
    for (const line of lines) {
      const key =
        dim === 'customer'
          ? (line.order.customer?.name ?? '—')
          : dim === 'product'
            ? line.item.name
            : line.item.sku;
      const cur = buckets.get(key) ?? {
        revenue: new Prisma.Decimal(0),
        cost: new Prisma.Decimal(0),
      };
      cur.revenue = cur.revenue.add(line.lineTotal);
      const costEst = line.unitPrice.mul(0.7).mul(line.quantity);
      cur.cost = cur.cost.add(costEst);
      buckets.set(key, cur);
    }
    return [...buckets.entries()].map(([label, v]) => ({
      label,
      revenue: v.revenue,
      cost: v.cost,
      marginPct: v.revenue.isZero()
        ? new Prisma.Decimal(0)
        : v.revenue.sub(v.cost).div(v.revenue).mul(100),
    }));
  }

  async purchaseVariance() {
    const { tenantId } = this.ctx();
    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: { order: { tenantId } },
      include: { item: true, order: { include: { vendor: true } } },
      orderBy: { order: { orderDate: 'desc' } },
      take: 200,
    });
    return lines.map((l) => ({
      orderNumber: l.order.number,
      vendor: l.order.vendor.name,
      item: l.item.name,
      poUnitCost: l.unitCost,
      landedCost: l.landedCostAmount,
      variance: l.landedCostAmount.sub(l.unitCost.mul(l.quantity)),
    }));
  }

  async fefoRisk(days = 7) {
    const { tenantId } = this.ctx();
    const until = new Date();
    until.setDate(until.getDate() + days);
    return this.prisma.inventoryLot.findMany({
      where: {
        tenantId,
        status: ProduceLotStatus.AVAILABLE,
        expirationDate: { lte: until },
        quantityOnHandKg: { gt: new Prisma.Decimal(0) },
      },
      orderBy: { expirationDate: 'asc' },
      take: 100,
      include: { item: true, warehouse: true },
    });
  }

  async shrinkage() {
    const { tenantId } = this.ctx();
    return this.prisma.inventoryLossEvent.groupBy({
      by: ['reason'],
      where: { tenantId },
      _sum: { quantityKg: true, costImpact: true },
    });
  }

  async lotAging() {
    const { tenantId } = this.ctx();
    const lots = await this.prisma.inventoryLot.findMany({
      where: { tenantId, quantityOnHandKg: { gt: 0 } },
      select: { receivedDate: true, quantityOnHandKg: true },
      take: 5000,
    });
    const now = Date.now();
    const buckets = { '0-3d': 0, '4-7d': 0, '8-14d': 0, '15d+': 0 };
    for (const lot of lots) {
      const age = Math.floor((now - lot.receivedDate.getTime()) / 86400000);
      const kg = lot.quantityOnHandKg.toNumber();
      if (age <= 3) buckets['0-3d'] += kg;
      else if (age <= 7) buckets['4-7d'] += kg;
      else if (age <= 14) buckets['8-14d'] += kg;
      else buckets['15d+'] += kg;
    }
    return buckets;
  }

  async receivingStatus() {
    const { tenantId } = this.ctx();
    const [openPos, pendingQc] = await Promise.all([
      this.prisma.purchaseOrder.count({
        where: {
          tenantId,
          status: {
            in: [
              DocumentStatus.OPEN,
              DocumentStatus.RELEASED,
              DocumentStatus.PARTIALLY_RECEIVED,
            ],
          },
        },
      }),
      this.prisma.qualityInspection.count({
        where: { tenantId, status: QualityInspectionStatus.PENDING },
      }),
    ]);
    return { openPurchaseOrders: openPos, pendingQualityInspections: pendingQc };
  }

  uomExceptions() {
    const { tenantId } = this.ctx();
    return this.prisma.uomConversionException.findMany({
      where: { tenantId, resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
