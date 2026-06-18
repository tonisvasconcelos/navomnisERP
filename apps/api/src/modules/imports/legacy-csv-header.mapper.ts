import { Prisma } from '@prisma/client';
import type { ParsedCsvRow } from './csv-parser.util';

export function csvField(row: ParsedCsvRow, ...labels: string[]): string {
  for (const label of labels) {
    if (row[label]?.trim()) return row[label].trim();
  }
  const lower = labels[0]?.toLowerCase() ?? '';
  const key = Object.keys(row).find((k) => k.toLowerCase().includes(lower));
  return key ? (row[key]?.trim() ?? '') : '';
}

export function parseBrDate(value: string): Date | undefined {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0));
}

export function parseBrTime(value: string): { hours: number; minutes: number } | undefined {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

export function parseBrDateTime(dateValue: string, timeValue?: string): Date | undefined {
  const date = parseBrDate(dateValue);
  if (!date) return undefined;
  const time = timeValue ? parseBrTime(timeValue) : undefined;
  if (!time) return date;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      time.hours,
      time.minutes,
      0,
    ),
  );
}

export function parseBrDecimal(value: string): Prisma.Decimal | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  try {
    const dec = new Prisma.Decimal(normalized);
    return dec.isZero() ? undefined : dec;
  } catch {
    return undefined;
  }
}

export function parseBrDecimalOrZero(value: string): Prisma.Decimal {
  return parseBrDecimal(value) ?? new Prisma.Decimal(0);
}

export type SalesOrderHeaderData = {
  orderDate: Date;
  invoiceNumber?: string;
  shippedAt?: Date;
  invoicedAt?: Date;
  dueDate?: Date;
  paidAt?: Date;
  deliveryDate?: Date;
  warehouseCode?: string;
  warehouseName?: string;
  saleType?: string;
  salesRep?: string;
  enteredBy?: string;
  externalOrderRef?: string;
  cfop?: string;
  taxSituation?: string;
  fiscalKey?: string;
  freightAmount?: Prisma.Decimal;
  insuranceAmount?: Prisma.Decimal;
  discountAmount?: Prisma.Decimal;
  otherAmount?: Prisma.Decimal;
  legacyMetadata?: Prisma.InputJsonValue;
};

const LINE_FIELD_PREFIXES = [
  'cod. prod',
  'produto',
  'marca',
  'qtd',
  'valor venda',
  'total prod',
  'valor custo',
  'total custo',
  'unidade nf',
  'icm prod',
  'base icm',
  'ultimo custo',
];

const MAPPED_HEADER_KEYS = new Set(
  [
    'nf',
    'dt emissao',
    'dt emissão',
    'dt saida',
    'dt saída',
    'hora saida',
    'hora saída',
    'dt faturamento',
    'hora faturamento',
    'vencimentos',
    'pagamentos',
    'dt entrega do pedido',
    'local',
    'fantasia do local',
    'tipo de venda',
    'atendente',
    'digitador',
    'codigo do pedido',
    'código do pedido',
    'pedido',
    'cfop',
    'sit. trib.',
    'chave nfe',
    'frete',
    'seguro',
    'desconto',
    'outros',
    'cod. cliente',
    'cliente',
  ].map((k) => k.toLowerCase()),
);

function isLineField(key: string): boolean {
  const lower = key.toLowerCase();
  return LINE_FIELD_PREFIXES.some((p) => lower.includes(p));
}

function isMappedHeader(key: string): boolean {
  const lower = key.toLowerCase();
  if (MAPPED_HEADER_KEYS.has(lower)) return true;
  return MAPPED_HEADER_KEYS.has(lower.normalize('NFD').replace(/\p{M}/gu, ''));
}

export function extractLegacyMetadata(payload: ParsedCsvRow): Record<string, string> | undefined {
  const legacy: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!value?.trim()) continue;
    if (isLineField(key) || isMappedHeader(key)) continue;
    legacy[key] = value.trim();
  }
  return Object.keys(legacy).length ? legacy : undefined;
}

export function mapSalesCsvHeader(payload: ParsedCsvRow): SalesOrderHeaderData {
  const orderDate =
    parseBrDate(csvField(payload, 'Dt Emissão', 'Dt Emissao')) ?? new Date();
  const externalOrderRef =
    csvField(payload, 'Código do Pedido', 'Codigo do Pedido') ||
    csvField(payload, 'PEDIDO') ||
    undefined;

  return {
    orderDate,
    invoiceNumber: csvField(payload, 'NF') || undefined,
    shippedAt: parseBrDateTime(
      csvField(payload, 'Dt Saida', 'Dt Saída'),
      csvField(payload, 'Hora Saida', 'Hora Saída'),
    ),
    invoicedAt: parseBrDateTime(
      csvField(payload, 'Dt Faturamento'),
      csvField(payload, 'Hora Faturamento'),
    ),
    dueDate: parseBrDate(csvField(payload, 'Vencimentos')),
    paidAt: parseBrDate(csvField(payload, 'Pagamentos')),
    deliveryDate: parseBrDate(csvField(payload, 'Dt Entrega do Pedido')),
    warehouseCode: csvField(payload, 'Local') || undefined,
    warehouseName: csvField(payload, 'Fantasia do Local') || undefined,
    saleType: csvField(payload, 'Tipo de Venda', 'Tipo Venda') || undefined,
    salesRep: csvField(payload, 'Atendente') || undefined,
    enteredBy: csvField(payload, 'Digitador') || undefined,
    externalOrderRef: externalOrderRef || undefined,
    cfop: csvField(payload, 'Cfop') || undefined,
    taxSituation: csvField(payload, 'Sit. Trib.') || undefined,
    fiscalKey: csvField(payload, 'Chave NFE') || undefined,
    freightAmount: parseBrDecimal(csvField(payload, 'Frete')),
    insuranceAmount: parseBrDecimal(csvField(payload, 'Seguro')),
    discountAmount: parseBrDecimal(csvField(payload, 'Desconto')),
    otherAmount: parseBrDecimal(csvField(payload, 'Outros')),
    legacyMetadata: extractLegacyMetadata(payload),
  };
}

export function salesOrderNumberFromNf(nf: string): string {
  return `SO-${nf.replace(/\//g, '').trim()}`.slice(0, 40);
}
