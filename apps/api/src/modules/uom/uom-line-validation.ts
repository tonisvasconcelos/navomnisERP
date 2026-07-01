import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type UomSnapshotLine = {
  transactionUomId?: string | null;
  baseUomId?: string | null;
  baseQuantity?: Prisma.Decimal | null;
  conversionTrace?: Prisma.JsonValue | null;
  item?: { sku?: string; name?: string } | null;
};

export function assertCompleteUomSnapshot(line: UomSnapshotLine, skuHint?: string): void {
  const label = skuHint ?? line.item?.sku ?? line.item?.name ?? 'linha';
  if (!line.transactionUomId) {
    throw new BadRequestException(`UOM de transação em falta na linha ${label}.`);
  }
  if (!line.baseUomId) {
    throw new BadRequestException(`UOM base em falta na linha ${label}.`);
  }
  if (line.baseQuantity == null) {
    throw new BadRequestException(`Quantidade base em falta na linha ${label}.`);
  }
  if (line.conversionTrace == null) {
    throw new BadRequestException(`Rastreio de conversão em falta na linha ${label}.`);
  }
}
