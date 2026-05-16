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

  private async assertVendor(tx: PrismaTx, tenantId: string, vendorId: string) {
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
