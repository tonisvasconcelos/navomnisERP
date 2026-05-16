import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, PartyKind, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import type { UpdateSalesOrderLineDto } from './dto/update-sales-order-line.dto';

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private ctx() {
    const c = getTenantContext();
    if (!c) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return c;
  }

  listOrders() {
    const { tenantId } = this.ctx();
    return this.prisma.salesOrder.findMany({
      where: { tenantId },
      orderBy: { orderDate: 'desc' },
      take: 100,
      include: { customer: true, lines: { include: { item: true } } },
    });
  }

  async getOrder(orderId: string) {
    const { tenantId } = this.ctx();
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { customer: true, lines: { include: { item: true } } },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }
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
    dto: { itemId: string; quantity: string; unitPrice: string },
    req?: Request,
  ) {
    const { tenantId, userId } = this.ctx();
    const order = await this.getOrderOrThrow(tenantId, orderId);
    if (order.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Pedido não está em rascunho.');
    }
    await this.assertItem(tenantId, dto.itemId);
    const qty = new Prisma.Decimal(dto.quantity);
    const price = new Prisma.Decimal(dto.unitPrice);
    const lineTotal = qty.mul(price).toDecimalPlaces(2);
    await this.prisma.salesOrderLine.create({
      data: {
        orderId: order.id,
        itemId: dto.itemId,
        quantity: qty,
        unitPrice: price,
        lineTotal,
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
    return this.prisma.salesOrder.findFirstOrThrow({
      where: { id: order.id, tenantId },
      include: { lines: { include: { item: true } }, customer: true },
    });
  }

  async removeLine(orderId: string, lineId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const line = await this.prisma.salesOrderLine.findFirst({
      where: {
        id: lineId,
        orderId,
        order: { tenantId, status: DocumentStatus.DRAFT },
      },
    });
    if (!line) {
      throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
    }
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
      where: {
        id: lineId,
        orderId,
        order: { tenantId, status: DocumentStatus.DRAFT },
      },
    });
    if (!line) {
      throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
    }
    const qty = new Prisma.Decimal(dto.quantity);
    const price = new Prisma.Decimal(dto.unitPrice);
    const lineTotal = qty.mul(price).toDecimalPlaces(2);
    await this.prisma.salesOrderLine.update({
      where: { id: lineId },
      data: { quantity: qty, unitPrice: price, lineTotal },
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
    const released = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, tenantId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException('Pedido não encontrado.');
      }
      if (order.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException('Apenas rascunhos podem ser libertados.');
      }
      if (!order.lines.length) {
        throw new BadRequestException('Pedido sem linhas.');
      }
      await this.assertUserCompanyInTx(tx, userId, order.companyId);

      const itemIds = [...new Set(order.lines.map((l) => l.itemId))];
      const grouped = await tx.itemLedgerEntry.groupBy({
        by: ['itemId'],
        where: { tenantId, itemId: { in: itemIds } },
        _sum: { quantity: true },
      });
      const balanceBy = new Map(
        grouped.map((g) => [g.itemId, g._sum.quantity ?? new Prisma.Decimal(0)]),
      );
      for (const line of order.lines) {
        const available = balanceBy.get(line.itemId) ?? new Prisma.Decimal(0);
        if (available.lessThan(line.quantity)) {
          throw new BadRequestException(
            'Stock insuficiente para libertar o pedido (saldo ledger inferior à quantidade de uma linha).',
          );
        }
      }

      for (const line of order.lines) {
        await tx.itemLedgerEntry.create({
          data: {
            tenantId,
            itemId: line.itemId,
            quantity: line.quantity.mul(-1),
            entryType: 'SALES_RELEASE',
            documentType: 'SALES_ORDER',
            documentId: order.id,
          },
        });
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

    return this.prisma.salesOrder.findFirstOrThrow({
      where: { id: released.id, tenantId },
      include: { lines: { include: { item: true } }, customer: true },
    });
  }

  private async recalcOrderTotal(orderId: string, tenantId: string) {
    const lines = await this.prisma.salesOrderLine.findMany({ where: { orderId } });
    const sum = lines.reduce((acc, l) => acc.add(l.lineTotal), new Prisma.Decimal(0));
    await this.prisma.salesOrder.update({
      where: { id: orderId, tenantId },
      data: { totalAmount: sum },
    });
  }

  private async getOrderOrThrow(tenantId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }
    return order;
  }

  private async nextOrderNumberInTx(tx: PrismaTx, tenantId: string): Promise<string> {
    const row = await tx.documentNumberSeries.upsert({
      where: { tenantId_code: { tenantId, code: 'SALES_ORDER' } },
      create: { tenantId, code: 'SALES_ORDER', lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `PV-${String(row.lastNumber).padStart(4, '0')}`;
  }

  private async assertPartyCustomer(tenantId: string, partyId: string) {
    const p = await this.prisma.party.findFirst({
      where: {
        id: partyId,
        tenantId,
        kind: { in: [PartyKind.CUSTOMER, PartyKind.BOTH] },
      },
    });
    if (!p) {
      throw new BadRequestException('Cliente inválido para este tenant.');
    }
  }

  private async assertCompany(tenantId: string, companyId: string) {
    const c = await this.prisma.company.findFirst({ where: { id: companyId, tenantId } });
    if (!c) {
      throw new BadRequestException('Empresa inválida para este tenant.');
    }
  }

  private async assertItem(tenantId: string, itemId: string) {
    const i = await this.prisma.item.findFirst({ where: { id: itemId, tenantId } });
    if (!i) {
      throw new BadRequestException('Artigo inválido para este tenant.');
    }
  }

  private async assertUserCompany(userId: string, companyId: string) {
    const link = await this.prisma.userCompany.findFirst({ where: { userId, companyId } });
    if (!link) {
      throw new ForbiddenException('Sem acesso a esta empresa.');
    }
  }

  private async assertUserCompanyInTx(tx: PrismaTx, userId: string, companyId: string) {
    const link = await tx.userCompany.findFirst({ where: { userId, companyId } });
    if (!link) {
      throw new ForbiddenException('Sem acesso a esta empresa.');
    }
  }
}
