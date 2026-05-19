import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, PartyKind, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import type { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import type { UpdatePurchaseOrderLineDto } from './dto/update-purchase-order-line.dto';

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class PurchasesService {
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
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { orderDate: 'desc' },
      take: 100,
      include: { vendor: true, lines: { include: { item: true } } },
    });
  }

  async getOrder(orderId: string) {
    const { tenantId } = this.ctx();
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { vendor: true, lines: { include: { item: true } } },
    });
    if (!order) {
      throw new NotFoundException('Pedido de compra não encontrado.');
    }
    return order;
  }

  async createOrder(dto: { companyId: string; vendorId: string }, req?: Request) {
    const { tenantId, userId } = this.ctx();
    await this.assertVendor(this.prisma, tenantId, dto.vendorId);
    await this.assertCompany(tenantId, dto.companyId);
    await this.assertUserCompany(userId, dto.companyId);
    const order = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const number = await this.nextOrderNumberInTx(tx, tenantId);
      return tx.purchaseOrder.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          vendorId: dto.vendorId,
          number,
          status: DocumentStatus.DRAFT,
          totalAmount: new Prisma.Decimal(0),
        },
      });
    });
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.create',
      entityType: 'PurchaseOrder',
      entityId: order.id,
      metadata: { number: order.number },
      req,
    });
    return order;
  }

  async addLine(
    orderId: string,
    dto: { itemId: string; quantity: string; unitCost: string },
    req?: Request,
  ) {
    const { tenantId, userId } = this.ctx();
    const order = await this.getOrderOrThrow(tenantId, orderId);
    if (order.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Pedido não está em rascunho.');
    }
    await this.assertItem(tenantId, dto.itemId);
    const qty = new Prisma.Decimal(dto.quantity);
    const cost = new Prisma.Decimal(dto.unitCost);
    const lineTotal = qty.mul(cost).toDecimalPlaces(2);
    await this.prisma.purchaseOrderLine.create({
      data: {
        orderId: order.id,
        itemId: dto.itemId,
        quantity: qty,
        unitCost: cost,
        lineTotal,
      },
    });
    await this.recalcOrderTotal(order.id, tenantId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.line_add',
      entityType: 'PurchaseOrder',
      entityId: order.id,
      metadata: { itemId: dto.itemId },
      req,
    });
    return this.getOrder(orderId);
  }

  async removeLine(orderId: string, lineId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const line = await this.prisma.purchaseOrderLine.findFirst({
      where: {
        id: lineId,
        orderId,
        order: { tenantId, status: DocumentStatus.DRAFT },
      },
    });
    if (!line) {
      throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
    }
    await this.prisma.purchaseOrderLine.delete({ where: { id: lineId } });
    await this.recalcOrderTotal(orderId, tenantId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.line_remove',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      metadata: { lineId },
      req,
    });
    return this.getOrder(orderId);
  }

  async updateLine(orderId: string, lineId: string, dto: UpdatePurchaseOrderLineDto, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const line = await this.prisma.purchaseOrderLine.findFirst({
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
    const cost = new Prisma.Decimal(dto.unitCost);
    const lineTotal = qty.mul(cost).toDecimalPlaces(2);
    await this.prisma.purchaseOrderLine.update({
      where: { id: lineId },
      data: { quantity: qty, unitCost: cost, lineTotal },
    });
    await this.recalcOrderTotal(orderId, tenantId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.line_update',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      metadata: { lineId },
      req,
    });
    return this.getOrder(orderId);
  }

  async releaseOrder(orderId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const released = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, tenantId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException('Pedido de compra não encontrado.');
      }
      if (order.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException('Apenas rascunhos podem ser libertados.');
      }
      if (!order.lines.length) {
        throw new BadRequestException('Pedido sem linhas.');
      }
      await this.assertUserCompanyInTx(tx, userId, order.companyId);
      await this.assertVendor(tx, tenantId, order.vendorId);
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: DocumentStatus.OPEN },
      });
      return { id: order.id, number: order.number };
    });
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.release',
      entityType: 'PurchaseOrder',
      entityId: released.id,
      metadata: { number: released.number },
      req,
    });
    return this.getOrder(orderId);
  }

  async receiveOrder(orderId: string, dto: ReceivePurchaseOrderDto, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const received = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, tenantId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException('Pedido de compra não encontrado.');
      }
      if (order.status !== DocumentStatus.OPEN && order.status !== DocumentStatus.RELEASED) {
        throw new BadRequestException('Apenas pedidos OPEN ou RELEASED podem ser recebidos.');
      }
      await this.assertUserCompanyInTx(tx, userId, order.companyId);
      await this.assertVendor(tx, tenantId, order.vendorId);

      const lineById = new Map(order.lines.map((l) => [l.id, l]));
      const receiveByLine = new Map<string, Prisma.Decimal>();

      for (const row of dto.lines) {
        const line = lineById.get(row.lineId);
        if (!line) {
          throw new BadRequestException(`Linha ${row.lineId} não pertence ao pedido.`);
        }
        const qty = new Prisma.Decimal(row.quantity);
        if (qty.lte(0)) {
          throw new BadRequestException('Quantidade de receção deve ser positiva.');
        }
        const already = await this.receivedQtyForLine(tx, tenantId, line.id);
        const next = already.add(qty);
        if (next.gt(line.quantity)) {
          throw new BadRequestException(
            `Quantidade excede o pedido na linha ${line.id} (pedido ${line.quantity}, já recebido ${already}).`,
          );
        }
        receiveByLine.set(line.id, qty);
      }

      for (const [lineId, qty] of receiveByLine) {
        const line = lineById.get(lineId)!;
        await tx.itemLedgerEntry.create({
          data: {
            tenantId,
            itemId: line.itemId,
            quantity: qty,
            entryType: 'PURCHASE_RECEIVE',
            documentType: 'PURCHASE_ORDER_LINE',
            documentId: lineId,
            postingDate: new Date(),
          },
        });
      }

      const allFullyReceived = await Promise.all(
        order.lines.map(async (line) => {
          const receivedQty = await this.receivedQtyForLine(tx, tenantId, line.id);
          return receivedQty.gte(line.quantity);
        }),
      );
      const fullyReceived = allFullyReceived.every(Boolean);

      if (fullyReceived) {
        await tx.purchaseOrder.update({
          where: { id: order.id },
          data: { status: DocumentStatus.POSTED },
        });
      }

      return { id: order.id, number: order.number, fullyReceived };
    });

    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.receive',
      entityType: 'PurchaseOrder',
      entityId: received.id,
      metadata: { number: received.number, fullyReceived: received.fullyReceived },
      req,
    });

    return this.getOrder(orderId);
  }

  private async receivedQtyForLine(
    tx: PrismaTx,
    tenantId: string,
    lineId: string,
  ): Promise<Prisma.Decimal> {
    const agg = await tx.itemLedgerEntry.aggregate({
      where: {
        tenantId,
        documentType: 'PURCHASE_ORDER_LINE',
        documentId: lineId,
        entryType: 'PURCHASE_RECEIVE',
      },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? new Prisma.Decimal(0);
  }

  private async recalcOrderTotal(orderId: string, tenantId: string) {
    const lines = await this.prisma.purchaseOrderLine.findMany({ where: { orderId } });
    const sum = lines.reduce((acc, l) => acc.add(l.lineTotal), new Prisma.Decimal(0));
    await this.prisma.purchaseOrder.update({
      where: { id: orderId, tenantId },
      data: { totalAmount: sum },
    });
  }

  private async getOrderOrThrow(tenantId: string, orderId: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) {
      throw new NotFoundException('Pedido de compra não encontrado.');
    }
    return order;
  }

  private async nextOrderNumberInTx(tx: PrismaTx, tenantId: string): Promise<string> {
    const row = await tx.documentNumberSeries.upsert({
      where: { tenantId_code: { tenantId, code: 'PURCHASE_ORDER' } },
      create: { tenantId, code: 'PURCHASE_ORDER', lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `PC-${String(row.lastNumber).padStart(4, '0')}`;
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

  private async assertVendor(tx: PrismaTx | PrismaService, tenantId: string, vendorId: string) {
    const vendor = await tx.party.findFirst({
      where: {
        id: vendorId,
        tenantId,
        kind: { in: [PartyKind.SUPPLIER, PartyKind.BOTH] },
      },
    });
    if (!vendor) {
      throw new BadRequestException('Fornecedor inválido.');
    }
  }

  private async assertUserCompanyInTx(tx: PrismaTx, userId: string, companyId: string) {
    const link = await tx.userCompany.findFirst({ where: { userId, companyId } });
    if (!link) {
      throw new ForbiddenException('Utilizador sem acesso a esta empresa.');
    }
  }
}
