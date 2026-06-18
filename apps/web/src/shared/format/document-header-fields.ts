import {
  formatCurrencyBrl,
  formatDatePt,
  formatDateTimePt,
  formatOptionalText,
} from '@/shared/format/document';
import type { DocumentHeaderField } from '@/widgets/document-header-card';

type SalesHeaderSource = {
  number: string;
  invoiceNumber?: string | null;
  orderDate?: string | Date | null;
  shippedAt?: string | Date | null;
  invoicedAt?: string | Date | null;
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  deliveryDate?: string | Date | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  saleType?: string | null;
  salesRep?: string | null;
  enteredBy?: string | null;
  externalOrderRef?: string | null;
  cfop?: string | null;
  fiscalKey?: string | null;
  customer?: { name: string; taxId?: string | null };
  legacyMetadata?: Record<string, unknown> | null;
};

export function buildSalesHeaderFields(order: SalesHeaderSource): DocumentHeaderField[] {
  const city = order.legacyMetadata?.Cidade ?? order.legacyMetadata?.['Cidade'];
  const uf = order.legacyMetadata?.UF ?? order.legacyMetadata?.['UF'];
  const location = [city, uf].filter(Boolean).join(' / ');

  return [
    { label: 'NF', value: formatOptionalText(order.invoiceNumber ?? order.number), testId: 'sales-header-nf' },
    { label: 'Emissão', value: formatDatePt(order.orderDate), testId: 'sales-header-emissao' },
    { label: 'Saída', value: formatDateTimePt(order.shippedAt), testId: 'sales-header-saida' },
    { label: 'Faturamento', value: formatDateTimePt(order.invoicedAt), testId: 'sales-header-faturamento' },
    { label: 'Vencimento', value: formatDatePt(order.dueDate), testId: 'sales-header-vencimento' },
    { label: 'Pagamento', value: formatDatePt(order.paidAt), testId: 'sales-header-pagamento' },
    { label: 'Entrega', value: formatDatePt(order.deliveryDate), testId: 'sales-header-entrega' },
    {
      label: 'Cliente',
      value: formatOptionalText(order.customer?.name),
      testId: 'sales-header-cliente',
    },
    {
      label: 'Cód. cliente',
      value: formatOptionalText(order.customer?.taxId ?? undefined),
      testId: 'sales-header-cod-cliente',
    },
    { label: 'Cidade / UF', value: location ? String(location) : '—', testId: 'sales-header-cidade' },
    { label: 'Local', value: formatOptionalText(order.warehouseName ?? order.warehouseCode), testId: 'sales-header-local' },
    { label: 'Tipo venda', value: formatOptionalText(order.saleType), testId: 'sales-header-tipo' },
    { label: 'Atendente', value: formatOptionalText(order.salesRep), testId: 'sales-header-atendente' },
    { label: 'CFOP', value: formatOptionalText(order.cfop), testId: 'sales-header-cfop' },
    { label: 'Pedido ext.', value: formatOptionalText(order.externalOrderRef), testId: 'sales-header-pedido' },
    { label: 'Digitador', value: formatOptionalText(order.enteredBy), testId: 'sales-header-digitador' },
    { label: 'Chave NFE', value: formatOptionalText(order.fiscalKey), testId: 'sales-header-nfe' },
  ];
}

type PurchaseHeaderSource = {
  number: string;
  invoiceNumber?: string | null;
  orderDate?: string | Date | null;
  shippedAt?: string | Date | null;
  invoicedAt?: string | Date | null;
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  receivedAt?: string | Date | null;
  expectedDeliveryDate?: string | Date | null;
  paymentTerms?: string | null;
  freightTerms?: string | null;
  buyerNotes?: string | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  purchaseType?: string | null;
  buyerRep?: string | null;
  enteredBy?: string | null;
  externalOrderRef?: string | null;
  cfop?: string | null;
  fiscalKey?: string | null;
  vendor?: { name: string; taxId?: string | null };
  legacyMetadata?: Record<string, unknown> | null;
};

export function buildPurchaseHeaderFields(order: PurchaseHeaderSource): DocumentHeaderField[] {
  return [
    { label: 'NF', value: formatOptionalText(order.invoiceNumber ?? order.number), testId: 'purchase-header-nf' },
    { label: 'Emissão', value: formatDatePt(order.orderDate), testId: 'purchase-header-emissao' },
    { label: 'Entrega prev.', value: formatDatePt(order.expectedDeliveryDate), testId: 'purchase-header-entrega' },
    { label: 'Saída', value: formatDateTimePt(order.shippedAt), testId: 'purchase-header-saida' },
    { label: 'Faturamento', value: formatDateTimePt(order.invoicedAt), testId: 'purchase-header-faturamento' },
    { label: 'Receção', value: formatDateTimePt(order.receivedAt), testId: 'purchase-header-recepcao' },
    { label: 'Vencimento', value: formatDatePt(order.dueDate), testId: 'purchase-header-vencimento' },
    { label: 'Pagamento', value: formatDatePt(order.paidAt), testId: 'purchase-header-pagamento' },
    {
      label: 'Fornecedor',
      value: formatOptionalText(order.vendor?.name),
      testId: 'purchase-header-fornecedor',
    },
    {
      label: 'Cód. fornecedor',
      value: formatOptionalText(order.vendor?.taxId ?? undefined),
      testId: 'purchase-header-cod-fornecedor',
    },
    { label: 'Local', value: formatOptionalText(order.warehouseName ?? order.warehouseCode), testId: 'purchase-header-local' },
    { label: 'Tipo compra', value: formatOptionalText(order.purchaseType), testId: 'purchase-header-tipo' },
    { label: 'Comprador', value: formatOptionalText(order.buyerRep), testId: 'purchase-header-comprador' },
    { label: 'Condições pag.', value: formatOptionalText(order.paymentTerms), testId: 'purchase-header-pagamento-termos' },
    { label: 'Frete', value: formatOptionalText(order.freightTerms), testId: 'purchase-header-frete-termos' },
    { label: 'CFOP', value: formatOptionalText(order.cfop), testId: 'purchase-header-cfop' },
    { label: 'Pedido ext.', value: formatOptionalText(order.externalOrderRef), testId: 'purchase-header-pedido' },
    { label: 'Chave NFE', value: formatOptionalText(order.fiscalKey), testId: 'purchase-header-nfe' },
  ];
}

export { formatCurrencyBrl };
