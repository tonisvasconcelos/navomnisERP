import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, PartyKind, Prisma, ProduceLotStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import { TenantFeatureFlagsService } from '../feature-flags/tenant-feature-flags.service';
import { UomConversionService } from '../uom/uom-conversion.service';
import { assertCompleteUomSnapshot } from '../uom/uom-line-validation';
import type { UpdateSalesOrderLineDto } from './dto/update-sales-order-line.dto';
import { parseOrderDateRange } from '../../common/dto/list-document-orders-query.dto';

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uom: UomConversionService,
    private readonly flags: TenantFeatureFlagsService,
  ) {}

  private ctx() {
    const c = getTenantContext();
    if (!c) throw new ForbiddenException('Contexto de tenant ausente.');
    return c;
  }

  listOrders(query?: { fromDate?: string; toDate?: string; limit?: number }) {
    const { tenantId } = this.ctx();
    const take = Math.min(query?.limit ?? 10000, 15000);
    const orderDate = parseOrderDateRange(query?.fromDate, query?.toDate);
    return this.prisma.salesOrder.findMany({
      where: { tenantId, ...(orderDate ? { orderDate } : {}) },
      orderBy: { orderDate: 'desc' },
      take,
      select: {
        id: true,
        number: true,
        status: true,
        orderDate: true,
        totalAmount: true,
        customer: { select: { id: true, name: true, taxId: true } },
      },
    });
  }

  async getOrder(orderId: string) {
    const { tenantId } = this.ctx();
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, tenantId },
      include: {
        customer: true,
        lines: { include: { item: true, transactionUom: true, baseUom: true, lot: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  async createOrder(dto: { companyId: string; customerId: string }, req?: Request) {
    const { tenantId, userId } = this.ctx();
    await this.assertPartyCustomer(tenantId, dto.customerId);
    await this.assertCompany(tenantId, dto.companyId);
    await this.assertUserCompany(userId, dto.companyId);
    const order = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const number = await this.nextOrderNumberInTx(tx, tenantId);
      return tx.salesOrder.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          customerId: dto.customerId,
          number,
          status: DocumentStatus.DRAFT,
          totalAmount: new Prisma.Decimal(0),
        },
      });
    });
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'sales_order.create',
      entityType: 'SalesOrder',
      entityId: order.id,
      metadata: { number: order.number },
      req,
    });
    return order;
  }

  async addLine(
    orderId: string,
    dto: { itemId: string; quantity: string; unitPrice: string; transactionUomId?: string },
    req?: Request,
  ) {
    const { tenantId, userId } = this.ctx();
    const order = await this.getOrderOrThrow(tenantId, orderId);
    if (order.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Pedido não está em rascunho.');
    }
    await this.assertItem(tenantId, dto.itemId);
    const conv = await this.resolveLineConversion(dto.itemId, dto.quantity, dto.transactionUomId);
    const lineTotal = conv.transactionQuantity.mul(new Prisma.Decimal(dto.unitPrice)).toDecimalPlaces(2);
    await this.prisma.salesOrderLine.create({
      data: {
        orderId: order.id,
        itemId: dto.itemId,
        quantity: conv.transactionQuantity,
        unitPrice: new Prisma.Decimal(dto.unitPrice),
        lineTotal,
        transactionUomId: conv.transactionUomId,
        baseQuantity: conv.baseQuantity,
        baseUomId: conv.baseUomId,
        conversionFactor: conv.conversionFactor,
        conversionTrace: conv.conversionTrace as Prisma.InputJsonValue,
      },
    });
    await this.recalcOrderTotal(order.id, tenantId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'sales_order.line_add',
      entityType: 'SalesOrder',
      entityId: order.id,
      metadata: { itemId: dto.itemId },
      req,
    });
    return this.getOrder(orderId);
  }

  async removeLine(orderId: string, lineId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const line = await this.prisma.salesOrderLine.findFirst({
      where: { id: lineId, orderId, order: { tenantId, status: DocumentStatus.DRAFT } },
    });
    if (!line) throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
    await this.prisma.salesOrderLine.delete({ where: { id: lineId } });
    await this.recalcOrderTotal(orderId, tenantId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'sales_order.line_remove',
      entityType: 'SalesOrder',
      entityId: orderId,
      metadata: { lineId },
      req,
    });
    return this.getOrder(orderId);
  }

  async updateLine(orderId: string, lineId: string, dto: UpdateSalesOrderLineDto, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const line = await this.prisma.salesOrderLine.findFirst({
      where: { id: lineId, orderId, order: { tenantId, status: DocumentStatus.DRAFT } },
    });
    if (!line) throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
    const conv = await this.resolveLineConversion(
      line.itemId,
      dto.quantity,
      dto.transactionUomId ?? line.transactionUomId ?? undefined,
    );
    const lineTotal = conv.transactionQuantity.mul(new Prisma.Decimal(dto.unitPrice)).toDecimalPlaces(2);
    await this.prisma.salesOrderLine.update({
      where: { id: lineId },
      data: {
        quantity: conv.transactionQuantity,
        unitPrice: new Prisma.Decimal(dto.unitPrice),
        lineTotal,
        transactionUomId: conv.transactionUomId,
        baseQuantity: conv.baseQuantity,
        baseUomId: conv.baseUomId,
        conversionFactor: conv.conversionFactor,
        conversionTrace: conv.conversionTrace as Prisma.InputJsonValue,
      },
    });
    await this.recalcOrderTotal(orderId, tenantId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'sales_order.line_update',
      entityType: 'SalesOrder',
      entityId: orderId,
      metadata: { lineId },
      req,
    });
    return this.getOrder(orderId);
  }

  async releaseOrder(orderId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const fefoEnabled = await this.flags.isEnabled(tenantId, 'fefo_sales');
    const uomEnforced = await this.flags.isEnabled(tenantId, 'uom_enforcement');
    const released = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, tenantId },
        include: { lines: { include: { item: true } } },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (order.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException('Apenas rascunhos podem ser libertados.');
      }
      if (!order.lines.length) throw new BadRequestException('Pedido sem linhas.');
      await this.assertUserCompanyInTx(tx, userId, order.companyId);

      if (uomEnforced) {
        for (const line of order.lines) {
          assertCompleteUomSnapshot(line, line.item.sku);
        }
      }

      const itemIds = [...new Set(order.lines.map((l) => l.itemId))];
      const grouped = await tx.itemLedgerEntry.groupBy({
        by: ['itemId'],
        where: { tenantId, itemId: { in: itemIds } },
        _sum: { baseQuantity: true, quantity: true },
      });
      const balanceBy = new Map(
        grouped.map((g) => [
          g.itemId,
          g._sum.baseQuantity ?? g._sum.quantity ?? new Prisma.Decimal(0),
        ]),
      );

      for (const line of order.lines) {
        const need = line.baseQuantity ?? line.quantity;
        const available = balanceBy.get(line.itemId) ?? new Prisma.Decimal(0);
        if (available.lessThan(need)) {
          throw new BadRequestException(
            'Stock insuficiente (UOM base) para libertar o pedido.',
          );
        }
      }

      for (const line of order.lines) {
        const need = line.baseQuantity ?? line.quantity;
        let lotId = line.lotId;

        if (fefoEnabled && !lotId) {
          const lots = await tx.inventoryLot.findMany({
            where: {
              tenantId,
              itemId: line.itemId,
              status: ProduceLotStatus.AVAILABLE,
              quantityOnHandKg: { gt: 0 },
            },
            orderBy: [{ expirationDate: 'asc' }, { receivedDate: 'asc' }],
          });
          let remaining = need;
          for (const lot of lots) {
            if (remaining.lte(0)) break;
            const take = Prisma.Decimal.min(lot.quantityOnHandKg, remaining);
            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { quantityOnHandKg: lot.quantityOnHandKg.sub(take) },
            });
            remaining = remaining.sub(take);
            lotId = lot.id;
            await tx.itemLedgerEntry.create({
              data: {
                tenantId,
                itemId: line.itemId,
                lotId: lot.id,
                quantity: take.mul(-1),
                baseQuantity: take.mul(-1),
                baseUomId: line.baseUomId ?? undefined,
                entryType: 'SALES_RELEASE',
                documentType: 'SALES_ORDER',
                documentId: order.id,
              },
            });
          }
          if (remaining.gt(0)) {
            throw new BadRequestException('Stock FEFO insuficiente em lotes.');
          }
        } else {
          await tx.itemLedgerEntry.create({
            data: {
              tenantId,
              itemId: line.itemId,
              lotId: lotId ?? undefined,
              quantity: need.mul(-1),
              baseQuantity: need.mul(-1),
              transactionUomId: line.transactionUomId ?? undefined,
              baseUomId: line.baseUomId ?? undefined,
              conversionFactor: line.conversionFactor ?? undefined,
              conversionTrace: line.conversionTrace ?? undefined,
              entryType: 'SALES_RELEASE',
              documentType: 'SALES_ORDER',
              documentId: order.id,
            },
          });
        }

        if (fefoEnabled && lotId && lotId !== line.lotId) {
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { lotId },
          });
        }
      }

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: DocumentStatus.OPEN },
      });
      return { id: order.id, number: order.number };
    });

    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'sales_order.release',
      entityType: 'SalesOrder',
      entityId: released.id,
      metadata: { number: released.number },
      req,
    });

    return this.getOrder(orderId);
  }

  private async resolveLineConversion(itemId: string, quantity: string, transactionUomId?: string) {
    const uomEnforced = await this.flags.isEnabled(this.ctx().tenantId, 'uom_enforcement');
    if (transactionUomId) {
      return this.uom.convertItemQuantity({ itemId, quantity, fromUomId: transactionUomId });
    }
    if (uomEnforced) {
      throw new BadRequestException('transactionUomId é obrigatório com UOM enforcement ativo.');
    }
    const qty = new Prisma.Decimal(quantity);
    return {
      transactionQuantity: qty,
      transactionUomId: undefined as string | undefined,
      baseQuantity: qty,
      baseUomId: undefined as string | undefined,
      conversionFactor: new Prisma.Decimal(1),
      conversionTrace: { path: 'legacy' },
    };
  }

  private async recalcOrderTotal(orderId: string, tenantId: string) {
    const lines = await this.prisma.salesOrderLine.findMany({ where: { orderId } });
    const sum = lines.reduce((acc, l) => acc.add(l.lineTotal), new Prisma.Decimal(0));
    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: { totalAmount: sum },
    });
  }

  private async getOrderOrThrow(tenantId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  private async nextOrderNumberInTx(tx: PrismaTx, tenantId: string) {
    const row = await tx.documentNumberSeries.upsert({
      where: { tenantId_code: { tenantId, code: 'SALES_ORDER' } },
      create: { tenantId, code: 'SALES_ORDER', lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `PV-${String(row.lastNumber).padStart(4, '0')}`;
  }

  private async assertPartyCustomer(tenantId: string, partyId: string) {
    const p = await this.prisma.party.findFirst({
      where: { id: partyId, tenantId, kind: { in: [PartyKind.CUSTOMER, PartyKind.BOTH] } },
    });
    if (!p) throw new BadRequestException('Cliente inválido para este tenant.');
  }

  private async assertCompany(tenantId: string, companyId: string) {
    const c = await this.prisma.company.findFirst({ where: { id: companyId, tenantId } });
    if (!c) throw new BadRequestException('Empresa inválida para este tenant.');
  }

  private async assertItem(tenantId: string, itemId: string) {
    const i = await this.prisma.item.findFirst({ where: { id: itemId, tenantId } });
    if (!i) throw new BadRequestException('Artigo inválido para este tenant.');
  }

  private async assertUserCompany(userId: string, companyId: string) {
    const link = await this.prisma.userCompany.findFirst({ where: { userId, companyId } });
    if (!link) throw new ForbiddenException('Sem acesso a esta empresa.');
  }

  private async assertUserCompanyInTx(tx: PrismaTx, userId: string, companyId: string) {
    const link = await tx.userCompany.findFirst({ where: { userId, companyId } });
    if (!link) throw new ForbiddenException('Sem acesso a esta empresa.');
  }
}
