import { Injectable } from '@nestjs/common';
import { Prisma, UomRoundingMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { MissingUomConversionException } from './missing-uom-conversion.exception';

export type ConversionResult = {
  transactionQuantity: Prisma.Decimal;
  transactionUomId: string;
  baseQuantity: Prisma.Decimal;
  baseUomId: string;
  conversionFactor: Prisma.Decimal;
  conversionTrace: Record<string, unknown>;
};

@Injectable()
export class UomConversionService {
  constructor(private readonly prisma: PrismaService) {}

  async convertItemQuantity(input: {
    itemId: string;
    quantity: string | Prisma.Decimal;
    fromUomId: string;
    toUomId?: string;
    at?: Date;
  }): Promise<ConversionResult> {
    const ctx = getTenantContext();
    if (!ctx) throw new MissingUomConversionException('Contexto de tenant ausente.');
    const { tenantId } = ctx;
    const at = input.at ?? new Date();
    const qty = new Prisma.Decimal(input.quantity);

    const item = await this.prisma.item.findFirst({
      where: { id: input.itemId, tenantId },
      include: { baseUomRef: true },
    });
    if (!item) throw new MissingUomConversionException('Artigo não encontrado.');

    let baseUomId = item.baseUomId;
    if (!baseUomId) {
      const uom = await this.prisma.unitOfMeasure.findFirst({
        where: { tenantId, code: item.baseUom.toUpperCase() },
      });
      if (!uom) throw new MissingUomConversionException('UOM base do artigo não configurada.');
      baseUomId = uom.id;
    }

    const targetUomId = input.toUomId ?? baseUomId;
    if (input.fromUomId === targetUomId) {
      return {
        transactionQuantity: qty,
        transactionUomId: input.fromUomId,
        baseQuantity: qty,
        baseUomId: targetUomId,
        conversionFactor: new Prisma.Decimal(1),
        conversionTrace: { path: 'identity' },
      };
    }

    const { factor, trace } = await this.resolveFactor(
      tenantId,
      input.itemId,
      input.fromUomId,
      targetUomId,
      at,
    );
    const baseQty = this.applyRounding(qty.mul(factor), targetUomId, trace.roundingMode as UomRoundingMode);

    return {
      transactionQuantity: qty,
      transactionUomId: input.fromUomId,
      baseQuantity: baseQty,
      baseUomId: targetUomId,
      conversionFactor: factor,
      conversionTrace: trace,
    };
  }

  async resolveAlias(alias: string): Promise<string | null> {
    const ctx = getTenantContext();
    if (!ctx) return null;
    const normalized = alias.trim();
    const row = await this.prisma.unitOfMeasureAlias.findFirst({
      where: {
        tenantId: ctx.tenantId,
        alias: { equals: normalized, mode: 'insensitive' },
      },
    });
    return row?.uomId ?? null;
  }

  private async resolveFactor(
    tenantId: string,
    itemId: string,
    fromUomId: string,
    toUomId: string,
    at: Date,
  ): Promise<{ factor: Prisma.Decimal; trace: Record<string, unknown> }> {
    const direct = await this.findConversion(tenantId, itemId, fromUomId, toUomId, at);
    if (direct) {
      return {
        factor: direct.factor,
        trace: { path: 'direct', conversionId: direct.id, roundingMode: direct.roundingMode },
      };
    }

    const item = await this.prisma.item.findFirstOrThrow({ where: { id: itemId, tenantId } });
    const hubId = item.baseUomId;
    if (hubId && hubId !== fromUomId && hubId !== toUomId) {
      const leg1 = await this.findConversion(tenantId, itemId, fromUomId, hubId, at);
      const leg2 = await this.findConversion(tenantId, itemId, hubId, toUomId, at);
      if (leg1 && leg2) {
        return {
          factor: leg1.factor.mul(leg2.factor),
          trace: {
            path: 'hub',
            hubUomId: hubId,
            leg1: leg1.id,
            leg2: leg2.id,
            roundingMode: leg2.roundingMode,
          },
        };
      }
    }

    const reverse = await this.findConversion(tenantId, itemId, toUomId, fromUomId, at);
    if (reverse && !reverse.factor.isZero()) {
      return {
        factor: new Prisma.Decimal(1).div(reverse.factor),
        trace: { path: 'reverse', conversionId: reverse.id, roundingMode: reverse.roundingMode },
      };
    }

    await this.prisma.uomConversionException.create({
      data: {
        tenantId,
        itemId,
        context: 'convertItemQuantity',
        message: `Sem conversão ${fromUomId} → ${toUomId}`,
        payload: { fromUomId, toUomId, at: at.toISOString() },
      },
    });
    throw new MissingUomConversionException();
  }

  private findConversion(
    tenantId: string,
    itemId: string,
    fromUomId: string,
    toUomId: string,
    at: Date,
  ) {
    return this.prisma.itemUomConversion.findFirst({
      where: {
        tenantId,
        itemId,
        fromUomId,
        toUomId,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gte: at } }],
      },
      orderBy: { validFrom: 'desc' },
    });
  }

  private applyRounding(value: Prisma.Decimal, uomId: string, mode: UomRoundingMode): Prisma.Decimal {
    void uomId;
    const n = value.toNumber();
    switch (mode) {
      case 'CEIL':
        return new Prisma.Decimal(Math.ceil(n));
      case 'FLOOR':
        return new Prisma.Decimal(Math.floor(n));
      case 'HALF_DOWN':
        return new Prisma.Decimal(Math.round(n - 0.0001));
      case 'NONE':
        return value;
      default:
        return new Prisma.Decimal(Math.round(n * 1000) / 1000);
    }
  }
}
