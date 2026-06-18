import { Prisma } from '@prisma/client';
import {
  comprasSku,
  derivePurchaseQuantity,
  isComprasTotalRow,
  parseComprasExportYear,
  parseComprasMonthlyColumns,
  purchaseOrderNumberFromLegacy,
} from './legacy-csv-purchase.mapper';

describe('legacy-csv-purchase.mapper', () => {
  const sampleRow = {
    'Cód. Produto': '474',
    Produtos: 'Rucula Hidroponica',
    'Valor Jan FOB': '2.657,80',
    'Valor Jan CIF': '2.657,80',
    'Valor Fev FOB': '1.948,00',
    'Valor Fev CIF': '1.948,00',
    'Valor Mar FOB': '0',
    'Valor Mar CIF': '0',
    'Valor Abr FOB': '0',
    'Valor Abr CIF': '0',
    'Valor Mai FOB': '0',
    'Valor Mai CIF': '0',
    'Total FOB': '12.040,50',
    'Total CIF': '12.040,50',
  };

  it('parses monthly FOB/CIF columns with Brazilian decimals', () => {
    const months = parseComprasMonthlyColumns(sampleRow, 2026);
    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({ month: 1, year: 2026 });
    expect(months[0]!.fobAmount.toString()).toBe('2657.8');
    expect(months[1]!.fobAmount.toString()).toBe('1948');
  });

  it('builds idempotent purchase order numbers', () => {
    expect(purchaseOrderNumberFromLegacy('474', 2026, 1)).toBe('PO-474-202601');
  });

  it('detects total summary rows', () => {
    expect(isComprasTotalRow({ Produtos: 'Total' })).toBe(true);
    expect(isComprasTotalRow(sampleRow)).toBe(false);
  });

  it('derives quantity from FOB and average unit cost', () => {
    const qty = derivePurchaseQuantity(
      new Prisma.Decimal('1000'),
      new Prisma.Decimal('10'),
      undefined,
    );
    expect(qty?.toString()).toBe('100');
  });

  it('falls back to sales quantity when unit cost is missing', () => {
    const qty = derivePurchaseQuantity(
      new Prisma.Decimal('1000'),
      undefined,
      new Prisma.Decimal('50'),
    );
    expect(qty?.toString()).toBe('50');
  });

  it('extracts year from export timestamp line', () => {
    expect(parseComprasExportYear('11/06/2026 14:57;;;;;;;;;;;;;')).toBe(2026);
  });

  it('reads SKU from compras row', () => {
    expect(comprasSku(sampleRow)).toBe('474');
  });
});
