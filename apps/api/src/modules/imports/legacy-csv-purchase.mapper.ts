import { Prisma } from '@prisma/client';
import type { ParsedCsvRow } from './csv-parser.util';
import { csvField, parseBrDecimalOrZero } from './legacy-csv-header.mapper';

export type ComprasMonthlyValue = {
  month: number;
  year: number;
  fobAmount: Prisma.Decimal;
  cifAmount: Prisma.Decimal;
};

const MONTH_LABELS: { label: string; month: number }[] = [
  { label: 'Jan', month: 1 },
  { label: 'Fev', month: 2 },
  { label: 'Mar', month: 3 },
  { label: 'Abr', month: 4 },
  { label: 'Mai', month: 5 },
  { label: 'Jun', month: 6 },
  { label: 'Jul', month: 7 },
  { label: 'Ago', month: 8 },
  { label: 'Set', month: 9 },
  { label: 'Out', month: 10 },
  { label: 'Nov', month: 11 },
  { label: 'Dez', month: 12 },
];

export function comprasSku(row: ParsedCsvRow): string {
  return csvField(row, 'Cód. Produto', 'Cod. Produto', 'Cod Produto').trim();
}

export function comprasProductName(row: ParsedCsvRow): string {
  return csvField(row, 'Produtos', 'Produto').trim();
}

export function isComprasTotalRow(row: ParsedCsvRow): boolean {
  const sku = comprasSku(row);
  const name = comprasProductName(row).toLowerCase();
  return !sku && (name === 'total' || name === '');
}

export function parseComprasMonthlyColumns(
  row: ParsedCsvRow,
  defaultYear = 2026,
): ComprasMonthlyValue[] {
  const values: ComprasMonthlyValue[] = [];
  for (const { label, month } of MONTH_LABELS) {
    const fobKey = Object.keys(row).find(
      (k) => k.toLowerCase().includes(label.toLowerCase()) && k.toLowerCase().includes('fob'),
    );
    const cifKey = Object.keys(row).find(
      (k) => k.toLowerCase().includes(label.toLowerCase()) && k.toLowerCase().includes('cif'),
    );
    const fobAmount = parseBrDecimalOrZero(fobKey ? (row[fobKey] ?? '') : '');
    const cifAmount = parseBrDecimalOrZero(cifKey ? (row[cifKey] ?? '') : '');
    if (fobAmount.gt(0) || cifAmount.gt(0)) {
      values.push({ month, year: defaultYear, fobAmount, cifAmount });
    }
  }
  return values;
}

export function purchaseOrderNumberFromLegacy(sku: string, year: number, month: number): string {
  const yyyymm = `${year}${String(month).padStart(2, '0')}`;
  return `PO-${sku.replace(/\s+/g, '')}-${yyyymm}`.slice(0, 40);
}

export function lastDayOfMonthUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 12, 0, 0));
}

export function parseComprasExportYear(exportTimestampLine: string, fallback = 2026): number {
  const m = exportTimestampLine.trim().match(/\d{2}\/\d{2}\/(\d{4})/);
  if (!m) return fallback;
  const year = Number(m[1]);
  return Number.isFinite(year) ? year : fallback;
}

export function derivePurchaseQuantity(
  fobAmount: Prisma.Decimal,
  avgUnitCostFob: Prisma.Decimal | undefined,
  fallbackQty: Prisma.Decimal | undefined,
): Prisma.Decimal | undefined {
  if (avgUnitCostFob?.gt(0)) {
    return fobAmount.div(avgUnitCostFob).toDecimalPlaces(4);
  }
  if (fallbackQty?.gt(0)) return fallbackQty.toDecimalPlaces(4);
  return undefined;
}
