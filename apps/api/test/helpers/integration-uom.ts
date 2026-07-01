import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';

export async function getDemoUnUomId(prisma: PrismaService, tenantSlug = 'demo'): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } });
  const uom = await prisma.unitOfMeasure.findUniqueOrThrow({
    where: { tenantId_code: { tenantId: tenant.id, code: 'UN' } },
  });
  return uom.id;
}

export async function ensurePurchaseLineUomSnapshot(
  prisma: PrismaService,
  lineId: string,
  unUomId: string,
  quantity: Prisma.Decimal | string | number = 1,
): Promise<void> {
  const baseQty = quantity instanceof Prisma.Decimal ? quantity : new Prisma.Decimal(quantity);
  await prisma.purchaseOrderLine.update({
    where: { id: lineId },
    data: {
      transactionUomId: unUomId,
      baseUomId: unUomId,
      baseQuantity: baseQty,
      conversionFactor: 1,
      conversionTrace: { path: 'identity', fromUomId: unUomId, toUomId: unUomId },
    },
  });
}
