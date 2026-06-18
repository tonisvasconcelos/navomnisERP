export function formatDatePt(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatDateTimePt(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrencyBrl(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(String(value));
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatOptionalText(value?: string | null): string {
  if (!value?.trim()) return '—';
  return value.trim();
}

const DOCUMENT_STATUS_PT: Record<string, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  RELEASED: 'Libertado',
  POSTED: 'Lançado',
  CANCELLED: 'Cancelado',
  PENDING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  PARTIALLY_RECEIVED: 'Parcialmente recebido',
  RECEIVED: 'Recebido',
};

export function formatDocumentStatusPt(status?: string | null): string {
  if (!status?.trim()) return '—';
  const key = status.trim().toUpperCase();
  return DOCUMENT_STATUS_PT[key] ?? status;
}

export function documentStatusMatchesQuery(status: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const pt = formatDocumentStatusPt(status).toLowerCase();
  return status.toLowerCase().includes(q) || pt.includes(q);
}
