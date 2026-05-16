import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

const ENTITY_TYPES = ['', 'SalesOrder', 'SalesOrderLine', 'Item', 'Party'];

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [appliedEntityType, setAppliedEntityType] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const queryKey = useMemo(
    () => ['audit-logs', appliedAction, appliedEntityType, appliedFrom, appliedTo] as const,
    [appliedAction, appliedEntityType, appliedFrom, appliedTo],
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: envelope } = await api.get('/audit/logs', {
        params: {
          take: 100,
          ...(appliedAction.trim() ? { action: appliedAction.trim() } : {}),
          ...(appliedEntityType.trim() ? { entityType: appliedEntityType.trim() } : {}),
          ...(appliedFrom.trim() ? { from: new Date(appliedFrom).toISOString() } : {}),
          ...(appliedTo.trim() ? { to: new Date(appliedTo).toISOString() } : {}),
        },
      });
      return unwrap<AuditRow[]>(envelope);
    },
  });

  const applyFilters = () => {
    setAppliedAction(actionFilter);
    setAppliedEntityType(entityTypeFilter);
    setAppliedFrom(fromFilter);
    setAppliedTo(toFilter);
  };

  const clearFilters = () => {
    setActionFilter('');
    setEntityTypeFilter('');
    setFromFilter('');
    setToFilter('');
    setAppliedAction('');
    setAppliedEntityType('');
    setAppliedFrom('');
    setAppliedTo('');
  };

  if (isLoading) {
    return <p className="text-sm text-slate-500">A carregar…</p>;
  }

  if (error) {
    const msg = getApiErrorMessage(error, 'Erro ao carregar auditoria.');
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {msg}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white" data-testid="audit-page-title">
        Auditoria
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Últimas mutações do tenant (mais recentes primeiro).</p>

      <div
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        role="search"
        aria-label="Filtrar registos de auditoria"
      >
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor="audit-filter-action" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Ação (contém)
          </label>
          <input
            id="audit-filter-action"
            type="search"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="ex.: sales_order"
          />
        </div>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor="audit-filter-entity" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Tipo de entidade
          </label>
          <select
            id="audit-filter-entity"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Todas</option>
            {ENTITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[10rem] flex-col gap-1">
          <label htmlFor="audit-filter-from" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            De
          </label>
          <input
            id="audit-filter-from"
            type="datetime-local"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex min-w-[10rem] flex-col gap-1">
          <label htmlFor="audit-filter-to" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Até
          </label>
          <input
            id="audit-filter-to"
            type="datetime-local"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
        >
          Atualizar
        </button>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Aplicar filtros
        </button>
        <button type="button" onClick={clearFilters} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Limpar
        </button>
        {isFetching ? <span className="text-xs text-slate-500">A filtrar…</span> : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {!data?.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Sem registos.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                  <td className="px-4 py-3">{row.entityType}</td>
                  <td className="max-w-[12rem] truncate px-4 py-3 font-mono text-xs text-slate-500">{row.entityId ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
