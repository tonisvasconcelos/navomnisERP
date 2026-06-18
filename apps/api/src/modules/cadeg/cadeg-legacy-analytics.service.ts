import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ParsedCsvRow } from '../imports/csv-parser.util';
import { csvField, parseBrDate, parseBrDecimalOrZero } from '../imports/legacy-csv-header.mapper';

export type SalesSkuMonthKey = string;

export type SalesMonthAggregate = {
  sku: string;
  year: number;
  month: number;
  totalQtySold: Prisma.Decimal;
  totalCostFob: Prisma.Decimal;
  topSupplier: string | null;
  uomAlias: string | null;
};

function aggregateKey(sku: string, year: number, month: number): SalesSkuMonthKey {
  return `${sku}|${year}|${month}`;
}

function salesSku(row: ParsedCsvRow): string {
  return csvField(row, 'Cod. Prod', 'Cód. Prod').trim();
}

function salesMonthYear(row: ParsedCsvRow): { year: number; month: number } | undefined {
  const monthRaw = csvField(row, 'Mês', 'Mes', 'Mкs');
  const yearRaw = csvField(row, 'Ano');
  if (monthRaw && yearRaw) {
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (month >= 1 && month <= 12 && year >= 2000) return { year, month };
  }
  const emission = parseBrDate(csvField(row, 'Dt Emissão', 'Dt Emissao'));
  if (!emission) return undefined;
  return { year: emission.getUTCFullYear(), month: emission.getUTCMonth() + 1 };
}

@Injectable()
export class CadegLegacyAnalyticsService {
  aggregateSalesRows(rows: ParsedCsvRow[]): Map<SalesSkuMonthKey, SalesMonthAggregate> {
    const buckets = new Map<
      SalesSkuMonthKey,
      {
        sku: string;
        year: number;
        month: number;
        totalQtySold: Prisma.Decimal;
        totalCostFob: Prisma.Decimal;
        supplierCounts: Map<string, number>;
        uomAlias: string | null;
      }
    >();

    for (const row of rows) {
      const sku = salesSku(row);
      if (!sku) continue;
      const period = salesMonthYear(row);
      if (!period) continue;

      const qty = parseBrDecimalOrZero(csvField(row, 'Qtd'));
      if (qty.lte(0)) continue;

      const totalLineFob = parseBrDecimalOrZero(csvField(row, 'Total Custo FOB'));
      const lineCostFob = totalLineFob.gt(0)
        ? totalLineFob
        : qty.mul(parseBrDecimalOrZero(csvField(row, 'Valor Custo FOB')));

      const key = aggregateKey(sku, period.year, period.month);
      const supplier = csvField(row, 'Fornecedor').trim();
      const uomAlias = csvField(row, 'Unidade NF').trim() || null;

      const cur = buckets.get(key) ?? {
        sku,
        year: period.year,
        month: period.month,
        totalQtySold: new Prisma.Decimal(0),
        totalCostFob: new Prisma.Decimal(0),
        supplierCounts: new Map<string, number>(),
        uomAlias,
      };

      cur.totalQtySold = cur.totalQtySold.add(qty);
      cur.totalCostFob = cur.totalCostFob.add(lineCostFob);
      if (supplier) {
        cur.supplierCounts.set(supplier, (cur.supplierCounts.get(supplier) ?? 0) + 1);
      }
      if (!cur.uomAlias && uomAlias) cur.uomAlias = uomAlias;
      buckets.set(key, cur);
    }

    const result = new Map<SalesSkuMonthKey, SalesMonthAggregate>();
    for (const [key, bucket] of buckets) {
      let topSupplier: string | null = null;
      let topCount = 0;
      for (const [name, count] of bucket.supplierCounts) {
        if (count > topCount) {
          topCount = count;
          topSupplier = name;
        }
      }
      result.set(key, {
        sku: bucket.sku,
        year: bucket.year,
        month: bucket.month,
        totalQtySold: bucket.totalQtySold,
        totalCostFob: bucket.totalCostFob,
        topSupplier,
        uomAlias: bucket.uomAlias,
      });
    }
    return result;
  }

  lookupAggregate(
    aggregates: Map<SalesSkuMonthKey, SalesMonthAggregate>,
    sku: string,
    year: number,
    month: number,
  ): SalesMonthAggregate | undefined {
    return aggregates.get(aggregateKey(sku, year, month));
  }

  avgUnitCostFob(aggregate: SalesMonthAggregate | undefined): Prisma.Decimal | undefined {
    if (!aggregate || aggregate.totalQtySold.lte(0)) return undefined;
    return aggregate.totalCostFob.div(aggregate.totalQtySold);
  }
}
