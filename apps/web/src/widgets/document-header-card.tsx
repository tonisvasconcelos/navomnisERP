import { useState } from 'react';
import { formatCurrencyBrl } from '@/shared/format/document';

export type DocumentHeaderField = {
  label: string;
  value: string;
  testId?: string;
};

type DocumentHeaderCardProps = {
  title: string;
  subtitle?: string;
  status: string;
  totalAmount?: unknown;
  fields: DocumentHeaderField[];
  legacyMetadata?: Record<string, unknown> | null;
  titleTestId?: string;
  statusTestId?: string;
};

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'POSTED' || s === 'OPEN' || s === 'RELEASED' || s === 'RECEIVED') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
  }
  if (s === 'DRAFT') {
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
  if (s === 'APPROVED' || s === 'PARTIALLY_RECEIVED') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200';
}

export function DocumentHeaderCard({
  title,
  subtitle,
  status,
  totalAmount,
  fields,
  legacyMetadata,
  titleTestId = 'document-header-title',
  statusTestId = 'document-header-status',
}: DocumentHeaderCardProps) {
  const [copied, setCopied] = useState(false);
  const legacyEntries = legacyMetadata
    ? Object.entries(legacyMetadata).filter(([, v]) => v !== null && v !== undefined && String(v).trim())
    : [];

  const fiscalField = fields.find((f) => f.label === 'Chave NFE');
  const gridFields = fields.filter((f) => f.label !== 'Chave NFE');

  const copyFiscalKey = async () => {
    if (!fiscalField?.value || fiscalField.value === '—') return;
    await navigator.clipboard.writeText(fiscalField.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      data-testid="document-header-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white" data-testid={titleTestId}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
            data-testid={statusTestId}
          >
            {status}
          </span>
          {totalAmount !== undefined ? (
            <span
              className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white"
              data-testid="document-header-total"
            >
              {formatCurrencyBrl(totalAmount)}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-5">
        {gridFields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {field.label}
            </dt>
            <dd
              className="mt-0.5 text-sm text-slate-900 dark:text-slate-100"
              data-testid={field.testId}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      {fiscalField && fiscalField.value !== '—' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Chave NFE</span>
          <code className="max-w-full truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {fiscalField.value.length > 44
              ? `${fiscalField.value.slice(0, 22)}…${fiscalField.value.slice(-8)}`
              : fiscalField.value}
          </code>
          <button
            type="button"
            onClick={copyFiscalKey}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      ) : null}

      {legacyEntries.length ? (
        <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
            Mais detalhes ({legacyEntries.length})
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3 lg:grid-cols-4">
            {legacyEntries.map(([key, val]) => (
              <div key={key}>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{key}</dt>
                <dd className="text-sm text-slate-800 dark:text-slate-200">{String(val)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
