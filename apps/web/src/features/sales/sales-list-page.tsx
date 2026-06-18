import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import { formatCurrencyBrl, formatDatePt, formatDocumentStatusPt, documentStatusMatchesQuery } from '@/shared/format/document';

type SalesOrderRow = {
  id: string;
  number: string;
  status: string;
  orderDate?: string;
  totalAmount: unknown;
  customer?: { name: string };
};

type CompanyRow = { id: string; name: string };
type CustomerRow = { id: string; name: string };

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function SalesListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const orderQueryParams = useMemo(() => {
    const params: Record<string, string> = { limit: '10000' };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return params;
  }, [fromDate, toDate]);

  const companiesQ = useQuery({
    queryKey: ['parties-companies'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/parties/companies');
      return unwrap<CompanyRow[]>(envelope);
    },
  });

  const customersQ = useQuery({
    queryKey: ['parties-customers'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/parties/customers');
      return unwrap<CustomerRow[]>(envelope);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-orders', orderQueryParams],
    queryFn: async () => {
      const { data: envelope } = await api.get('/sales/orders', { params: orderQueryParams });
      return unwrap<SalesOrderRow[]>(envelope);
    },
  });

  const visibleOrders = useMemo(() => {
    if (!data?.length) return [];
    const q = search.trim().toLowerCase();
    let rows = data;
    if (q) {
      rows = rows.filter(
        (o) =>
          o.number.toLowerCase().includes(q) ||
          (o.customer?.name ?? '').toLowerCase().includes(q) ||
          documentStatusMatchesQuery(o.status, q),
      );
    }
    return [...rows].sort((a, b) => {
      const aTime = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const bTime = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      if (aTime !== bTime) return sortDesc ? bTime - aTime : aTime - bTime;
      const cmp = a.number.localeCompare(b.number, undefined, { numeric: true });
      return sortDesc ? -cmp : cmp;
    });
  }, [data, search, sortDesc]);

  useEffect(() => {
    if (companiesQ.data?.length && !companyId) setCompanyId(companiesQ.data[0].id);
  }, [companiesQ.data, companyId]);

  useEffect(() => {
    if (customersQ.data?.length && !customerId) setCustomerId(customersQ.data[0].id);
  }, [customersQ.data, customerId]);

  const createDraft = useMutation({
    mutationFn: async () => {
      if (!companyId || !customerId) throw new Error('Selecione empresa e cliente.');
      const { data: envelope } = await api.post('/sales/orders', { companyId, customerId });
      return unwrap<{ id: string; number: string }>(envelope);
    },
    onSuccess: async (created) => {
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ['sales-orders'] });
      navigate(`/sales/${created.id}`);
    },
    onError: (e: unknown) => {
      setFormError(getApiErrorMessage(e, 'Não foi possível criar o pedido.'));
    },
  });

  const mastersLoading = companiesQ.isLoading || customersQ.isLoading;
  const mastersError = companiesQ.error || customersQ.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Vendas — pedidos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Novo pedido: escolha empresa e cliente do tenant (API /parties).
          </p>
        </div>
        <button
          type="button"
          data-testid="sales-new-order"
          disabled={createDraft.isPending || mastersLoading || !companyId || !customerId}
          onClick={() => {
            setFormError(null);
            createDraft.mutate();
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {createDraft.isPending ? 'A criar…' : 'Novo pedido'}
        </button>
      </div>
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="sales-company">
            Empresa
          </label>
          <select
            id="sales-company"
            data-testid="sales-company-select"
            className="min-w-[12rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={mastersLoading || !companiesQ.data?.length}
          >
            {(companiesQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="sales-customer">
            Cliente
          </label>
          <select
            id="sales-customer"
            data-testid="sales-customer-select"
            className="min-w-[12rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={mastersLoading || !customersQ.data?.length}
          >
            {(customersQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mastersError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Não foi possível carregar empresas ou clientes.
        </p>
      )}

      {formError && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          data-testid="sales-list-error"
        >
          {formError}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Não foi possível carregar os pedidos.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor="sales-search" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Pesquisar
          </label>
          <input
            id="sales-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, cliente ou estado"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sales-from-date" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Emissão de
          </label>
          <input
            id="sales-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sales-to-date" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Emissão até
          </label>
          <input
            id="sales-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
        >
          Ordenar emissão {sortDesc ? '↓' : '↑'}
        </button>
      </div>

      {!isLoading && data?.length ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {visibleOrders.length} de {data.length} pedidos
          {fromDate || toDate ? ' (filtro de datas aplicado)' : ''}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Emissão</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  A carregar…
                </td>
              </tr>
            ) : !data?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Sem pedidos. Crie um rascunho com &quot;Novo pedido&quot;.
                </td>
              </tr>
            ) : !visibleOrders.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum pedido corresponde à pesquisa.
                </td>
              </tr>
            ) : (
              visibleOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                    <Link to={`/sales/${o.id}`} data-testid={`sales-order-link-${o.number}`}>
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{o.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDatePt(o.orderDate)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDocumentStatusPt(o.status)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">
                    {formatCurrencyBrl(o.totalAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
