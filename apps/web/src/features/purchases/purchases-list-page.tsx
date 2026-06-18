import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import { formatCurrencyBrl, formatDatePt, formatDocumentStatusPt, documentStatusMatchesQuery } from '@/shared/format/document';

type PurchaseOrderRow = {
  id: string;
  number: string;
  status: string;
  orderDate?: string;
  totalAmount: unknown;
  vendor?: { name: string };
};

type CompanyRow = { id: string; name: string };
type VendorRow = { id: string; name: string };

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'OPEN', label: 'Aberto' },
  { value: 'RELEASED', label: 'Libertado' },
  { value: 'POSTED', label: 'Lançado' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'PENDING_APPROVAL', label: 'Aguardando aprovação' },
  { value: 'APPROVED', label: 'Aprovado' },
  { value: 'PARTIALLY_RECEIVED', label: 'Parcialmente recebido' },
  { value: 'RECEIVED', label: 'Recebido' },
] as const;

export function PurchasesListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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

  const vendorsQ = useQuery({
    queryKey: ['parties-vendors'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/parties/vendors');
      return unwrap<VendorRow[]>(envelope);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', orderQueryParams],
    queryFn: async () => {
      const { data: envelope } = await api.get('/purchases/orders', { params: orderQueryParams });
      return unwrap<PurchaseOrderRow[]>(envelope);
    },
  });

  const visibleOrders = useMemo(() => {
    if (!data?.length) return [];
    const q = search.trim().toLowerCase();
    let rows = data;
    if (statusFilter) {
      rows = rows.filter((o) => o.status === statusFilter);
    }
    if (q) {
      rows = rows.filter(
        (o) =>
          o.number.toLowerCase().includes(q) ||
          (o.vendor?.name ?? '').toLowerCase().includes(q) ||
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
  }, [data, search, statusFilter, sortDesc]);

  useEffect(() => {
    if (companiesQ.data?.length && !companyId) setCompanyId(companiesQ.data[0].id);
  }, [companiesQ.data, companyId]);

  useEffect(() => {
    if (vendorsQ.data?.length && !vendorId) setVendorId(vendorsQ.data[0].id);
  }, [vendorsQ.data, vendorId]);

  const createDraft = useMutation({
    mutationFn: async () => {
      if (!companyId || !vendorId) throw new Error('Selecione empresa e fornecedor.');
      const { data: envelope } = await api.post('/purchases/orders', { companyId, vendorId });
      return unwrap<{ id: string; number: string }>(envelope);
    },
    onSuccess: async (created) => {
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate(`/purchases/${created.id}`);
    },
    onError: (e: unknown) => {
      setFormError(getApiErrorMessage(e, 'Não foi possível criar o pedido.'));
    },
  });

  const mastersLoading = companiesQ.isLoading || vendorsQ.isLoading;
  const mastersError = companiesQ.error || vendorsQ.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Compras — pedidos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pedidos de compra e receção de stock (slice B).
          </p>
        </div>
        <button
          type="button"
          data-testid="purchases-new-order"
          disabled={createDraft.isPending || mastersLoading || !companyId || !vendorId}
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
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="purchases-company">
            Empresa
          </label>
          <select
            id="purchases-company"
            data-testid="purchases-company-select"
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
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="purchases-vendor">
            Fornecedor
          </label>
          <select
            id="purchases-vendor"
            data-testid="purchases-vendor-select"
            className="min-w-[12rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            disabled={mastersLoading || !vendorsQ.data?.length}
          >
            {(vendorsQ.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mastersError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Não foi possível carregar empresas ou fornecedores.
        </p>
      )}

      {formError && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          data-testid="purchases-list-error"
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
          <label htmlFor="purchases-search" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Pesquisar
          </label>
          <input
            id="purchases-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, fornecedor ou estado"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <label htmlFor="purchases-status" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Estado
          </label>
          <select
            id="purchases-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="purchases-from-date" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Emissão de
          </label>
          <input
            id="purchases-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="purchases-to-date" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Emissão até
          </label>
          <input
            id="purchases-to-date"
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Fornecedor</th>
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
                  Sem pedidos. Crie um rascunho ou use o seed PC-0001.
                </td>
              </tr>
            ) : !visibleOrders.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum pedido corresponde aos filtros.
                </td>
              </tr>
            ) : (
              visibleOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                    <Link to={`/purchases/${o.id}`} data-testid={`purchase-order-link-${o.number}`}>
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{o.vendor?.name ?? '—'}</td>
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
