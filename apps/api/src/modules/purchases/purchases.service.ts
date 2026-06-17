import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  PartyKind,
  Prisma,
  ProduceLotStatus,
  QualityInspectionStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { TenantFeatureFlagsService } from '../feature-flags/tenant-feature-flags.service';
import { UomConversionService } from '../uom/uom-conversion.service';
import type { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import type { UpdatePurchaseOrderLineDto } from './dto/update-purchase-order-line.dto';

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uom: UomConversionService,
    private readonly approvals: ApprovalsService,
    private readonly flags: TenantFeatureFlagsService,
  ) {}

  private ctx() {
    const c = getTenantContext();
    if (!c) throw new ForbiddenException('Contexto de tenant ausente.');
    return c;
  }

  listOrders() {
    const { tenantId } = this.ctx();
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { orderDate: 'desc' },
      take: 100,
      include: {
        vendor: true,
        lines: { include: { item: true, transactionUom: true, baseUom: true } },
      },
    });
  }

  async getOrder(orderId: string) {
    const { tenantId } = this.ctx();
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: {
        vendor: true,
        lines: { include: { item: true, transactionUom: true, baseUom: true } },
        purchaseReceipts: { include: { lines: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido de compra não encontrado.');
    return order;
  }

  async createOrder(
    dto: {
      companyId: string;
      vendorId: string;
      expectedDeliveryDate?: string;
      paymentTerms?: string;
      freightTerms?: string;
      buyerNotes?: string;
    },
    req?: Request,
  ) {
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
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
          paymentTerms: dto.paymentTerms,
          freightTerms: dto.freightTerms,
          buyerNotes: dto.buyerNotes,
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
    dto: {
      itemId: string;
      quantity: string;
      unitCost: string;
      transactionUomId?: string;
      packageCount?: string;
      grossWeightKg?: string;
      tareWeightKg?: string;
      netWeightKg?: string;
    },
    req?: Request,
  ) {
    const { tenantId, userId } = this.ctx();
    const order = await this.getOrderOrThrow(tenantId, orderId);
    if (order.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Pedido não está em rascunho.');
    }
    await this.assertItem(tenantId, dto.itemId);
    const conv = await this.resolveLineConversion(dto.itemId, dto.quantity, dto.transactionUomId);
    const qty = conv.transactionQuantity;
    const cost = new Prisma.Decimal(dto.unitCost);
    const lineTotal = qty.mul(cost).toDecimalPlaces(2);
    await this.prisma.purchaseOrderLine.create({
      data: {
        orderId: order.id,
        itemId: dto.itemId,
        quantity: qty,
        unitCost: cost,
        lineTotal,
        transactionUomId: conv.transactionUomId,
        baseQuantity: conv.baseQuantity,
        baseUomId: conv.baseUomId,
        conversionFactor: conv.conversionFactor,
        conversionTrace: conv.conversionTrace as Prisma.InputJsonValue,
        packageCount: dto.packageCount ? new Prisma.Decimal(dto.packageCount) : undefined,
        grossWeightKg: dto.grossWeightKg ? new Prisma.Decimal(dto.grossWeightKg) : undefined,
        tareWeightKg: dto.tareWeightKg ? new Prisma.Decimal(dto.tareWeightKg) : undefined,
        netWeightKg: dto.netWeightKg ? new Prisma.Decimal(dto.netWeightKg) : undefined,
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
      where: { id: lineId, orderId, order: { tenantId, status: DocumentStatus.DRAFT } },
    });
    if (!line) throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
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
      where: { id: lineId, orderId, order: { tenantId, status: DocumentStatus.DRAFT } },
    });
    if (!line) throw new NotFoundException('Linha não encontrada ou pedido não está em rascunho.');
    const conv = await this.resolveLineConversion(line.itemId, dto.quantity, dto.transactionUomId);
    const cost = new Prisma.Decimal(dto.unitCost);
    const lineTotal = conv.transactionQuantity.mul(cost).toDecimalPlaces(2);
    await this.prisma.purchaseOrderLine.update({
      where: { id: lineId },
      data: {
        quantity: conv.transactionQuantity,
        unitCost: cost,
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
      action: 'purchase_order.line_update',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      metadata: { lineId },
      req,
    });
    return this.getOrder(orderId);
  }

  async submitForApproval(orderId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    await this.approvals.submitPurchaseOrder(orderId, userId);
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.submit_approval',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      req,
    });
    return this.getOrder(orderId);
  }

  async approveOrder(orderId: string, comment: string | undefined, req?: Request) {
    const { tenantId, userId } = this.ctx();
    await this.approvals.actOnPurchaseOrder(orderId, userId, 'APPROVE', { comment });
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.approve',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      req,
    });
    return this.getOrder(orderId);
  }

  async rejectOrder(orderId: string, comment: string | undefined, req?: Request) {
    const { tenantId, userId } = this.ctx();
    await this.approvals.actOnPurchaseOrder(orderId, userId, 'REJECT', { comment });
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.reject',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      req,
    });
    return this.getOrder(orderId);
  }

  async requestChanges(orderId: string, comment: string | undefined, req?: Request) {
    const { tenantId, userId } = this.ctx();
    await this.approvals.actOnPurchaseOrder(orderId, userId, 'REQUEST_CHANGES', { comment });
    await this.audit.logMutation({
      tenantId,
      actorId: userId,
      action: 'purchase_order.request_changes',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      req,
    });
    return this.getOrder(orderId);
  }

  async releaseOrder(orderId: string, req?: Request) {
    const { tenantId, userId } = this.ctx();
    const approvalRequired = await this.flags.isEnabled(tenantId, 'po_approval_required');
    const released = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, tenantId },
        include: { lines: true },
      });
      if (!order) throw new NotFoundException('Pedido de compra não encontrado.');
      const policy = await this.approvals.findPolicyForPurchaseOrder(tx, tenantId, order);
      const needsApproval = approvalRequired && Boolean(policy);
      const allowedStatus = needsApproval ? DocumentStatus.APPROVED : DocumentStatus.DRAFT;
      if (order.status !== allowedStatus) {
        throw new BadRequestException(
          needsApproval
            ? 'Pedido deve estar aprovado antes de libertar.'
            : 'Apenas rascunhos podem ser libertados.',
        );
      }
      if (!order.lines.length) throw new BadRequestException('Pedido sem linhas.');
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
      if (!order) throw new NotFoundException('Pedido de compra não encontrado.');
      if (
        order.status !== DocumentStatus.OPEN &&
        order.status !== DocumentStatus.RELEASED &&
        order.status !== DocumentStatus.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException('Pedido não está aberto para receção.');
      }
      await this.assertUserCompanyInTx(tx, userId, order.companyId);

      const receipt = await tx.purchaseReceipt.create({
        data: {
          tenantId,
          purchaseOrderId: order.id,
          warehouseId: dto.warehouseId,
          zoneId: dto.zoneId,
          receivedById: userId,
        },
      });

      const lineById = new Map(order.lines.map((l) => [l.id, l]));

      for (const row of dto.lines) {
        const line = lineById.get(row.lineId);
        if (!line) throw new BadRequestException(`Linha ${row.lineId} não pertence ao pedido.`);
        const txQty = new Prisma.Decimal(row.quantity);
        if (txQty.lte(0)) throw new BadRequestException('Quantidade de receção deve ser positiva.');

        const conv = row.transactionUomId
          ? await this.uom.convertItemQuantity({
              itemId: line.itemId,
              quantity: row.quantity,
              fromUomId: row.transactionUomId,
            })
          : {
              transactionQuantity: txQty,
              transactionUomId: line.transactionUomId,
              baseQuantity: line.baseQuantity
                ? line.baseQuantity.mul(txQty.div(line.quantity))
                : txQty,
              baseUomId: line.baseUomId,
              conversionFactor: line.conversionFactor ?? new Prisma.Decimal(1),
              conversionTrace: line.conversionTrace ?? { path: 'line_prorate' },
            };

        const already = await this.receivedBaseQtyForLine(tx, tenantId, line.id);
        const lineBase = line.baseQuantity ?? line.quantity;
        const next = already.add(conv.baseQuantity);
        if (next.gt(lineBase)) {
          throw new BadRequestException(`Quantidade excede o pedido na linha ${line.id}.`);
        }

        let lotId: string | undefined;
        if (row.lotCode || dto.createLot !== false) {
          const lotNumber = (row.lotCode ?? `${order.number}-${line.id.slice(0, 8)}`).toUpperCase();
          const lot = await tx.inventoryLot.create({
            data: {
              tenantId,
              itemId: line.itemId,
              lotNumber,
              warehouseId: dto.warehouseId ?? row.warehouseId,
              zoneId: dto.zoneId ?? row.zoneId,
              initialQuantityKg: conv.baseQuantity,
              quantityOnHandKg: conv.baseQuantity,
              receivedDate: new Date(),
              expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
              status: row.createQualityInspection
                ? ProduceLotStatus.QUARANTINED
                : ProduceLotStatus.AVAILABLE,
            },
          });
          lotId = lot.id;
          const costAmount = line.unitCost.mul(conv.transactionQuantity);
          const valueEntry = await tx.inventoryValueEntry.create({
            data: {
              tenantId,
              itemId: line.itemId,
              lotId: lot.id,
              entryType: 'PURCHASE_RECEIVE',
              quantity: conv.baseQuantity,
              costAmount,
              documentType: 'PURCHASE_RECEIPT_LINE',
              documentId: receipt.id,
            },
          });
          if (row.createQualityInspection) {
            await tx.qualityInspection.create({
              data: {
                tenantId,
                itemId: line.itemId,
                lotId: lot.id,
                purchaseOrderId: order.id,
                status: QualityInspectionStatus.PENDING,
                inspectionDate: new Date(),
                inspectorUserId: userId,
              },
            });
          }
          await tx.itemLedgerEntry.create({
            data: {
              tenantId,
              itemId: line.itemId,
              quantity: conv.baseQuantity,
              baseQuantity: conv.baseQuantity,
              transactionUomId: conv.transactionUomId ?? undefined,
              baseUomId: conv.baseUomId ?? undefined,
              conversionFactor: conv.conversionFactor,
              conversionTrace: conv.conversionTrace as Prisma.InputJsonValue,
              lotId: lot.id,
              warehouseId: dto.warehouseId ?? row.warehouseId,
              zoneId: dto.zoneId ?? row.zoneId,
              valueEntryId: valueEntry.id,
              entryType: 'PURCHASE_RECEIVE',
              documentType: 'PURCHASE_ORDER_LINE',
              documentId: line.id,
              postingDate: new Date(),
            },
          });
        } else {
          await tx.itemLedgerEntry.create({
            data: {
              tenantId,
              itemId: line.itemId,
              quantity: conv.baseQuantity,
              baseQuantity: conv.baseQuantity,
              transactionUomId: conv.transactionUomId ?? undefined,
              baseUomId: conv.baseUomId ?? undefined,
              conversionFactor: conv.conversionFactor,
              conversionTrace: conv.conversionTrace as Prisma.InputJsonValue,
              entryType: 'PURCHASE_RECEIVE',
              documentType: 'PURCHASE_ORDER_LINE',
              documentId: line.id,
              postingDate: new Date(),
            },
          });
        }

        await tx.purchaseReceiptLine.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderLineId: line.id,
            transactionQuantity: conv.transactionQuantity,
            baseQuantity: conv.baseQuantity,
            lotId,
          },
        });

        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            receivedBaseQuantity: next,
          },
        });
      }

      const allFullyReceived = await Promise.all(
        order.lines.map(async (line) => {
          const receivedQty = await this.receivedBaseQtyForLine(tx, tenantId, line.id);
          const target = line.baseQuantity ?? line.quantity;
          return receivedQty.gte(target);
        }),
      );
      const fullyReceived = allFullyReceived.every(Boolean);
      const anyPartial = allFullyReceived.some((v) => !v);

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: fullyReceived
            ? DocumentStatus.RECEIVED
            : anyPartial
              ? DocumentStatus.PARTIALLY_RECEIVED
              : order.status,
        },
      });

      return { id: order.id, number: order.number, fullyReceived, receiptId: receipt.id };
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

  private async receivedBaseQtyForLine(tx: PrismaTx, tenantId: string, lineId: string) {
    const agg = await tx.itemLedgerEntry.aggregate({
      where: {
        tenantId,
        documentType: 'PURCHASE_ORDER_LINE',
        documentId: lineId,
        entryType: 'PURCHASE_RECEIVE',
      },
      _sum: { baseQuantity: true, quantity: true },
    });
    return agg._sum.baseQuantity ?? agg._sum.quantity ?? new Prisma.Decimal(0);
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
    if (!order) throw new NotFoundException('Pedido de compra não encontrado.');
    return order;
  }

  private async nextOrderNumberInTx(tx: PrismaTx, tenantId: string) {
    const row = await tx.documentNumberSeries.upsert({
      where: { tenantId_code: { tenantId, code: 'PURCHASE_ORDER' } },
      create: { tenantId, code: 'PURCHASE_ORDER', lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `PC-${String(row.lastNumber).padStart(4, '0')}`;
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

  private async assertVendor(tx: PrismaTx | PrismaService, tenantId: string, vendorId: string) {
    const vendor = await tx.party.findFirst({
      where: { id: vendorId, tenantId, kind: { in: [PartyKind.SUPPLIER, PartyKind.BOTH] } },
    });
    if (!vendor) throw new BadRequestException('Fornecedor inválido.');
  }

  private async assertUserCompanyInTx(tx: PrismaTx, userId: string, companyId: string) {
    const link = await tx.userCompany.findFirst({ where: { userId, companyId } });
    if (!link) throw new ForbiddenException('Utilizador sem acesso a esta empresa.');
  }
}
