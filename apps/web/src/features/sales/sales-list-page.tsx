import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import {
  documentStatusMatchesQuery,
  formatCurrencyBrl,
  formatDatePt,
  formatDocumentStatusPt,
} from '@/shared/format/document';

type SalesOrderRow = {
  id: string;
  number: string;
  status: string;
  orderDate?: string;
  totalAmount: unknown;
  customer?: { id?: string; name: string };
};

type CompanyRow = { id: string; name: string };
type CustomerRow = { id: string; name: string };
type ViewMode = 'list' | 'cards';

type ChartCustomer = {
  name: string;
  color: string;
};

type ChartMonth = {
  key: string;
  label: string;
  total: number;
  segments: {
    customer: string;
    total: number;
    color: string;
  }[];
};

const CUSTOMER_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#475569',
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'OPEN', label: 'Aberto' },
  { value: 'RELEASED', label: 'Libertado' },
  { value: 'POSTED', label: 'Lancado' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'PENDING_APPROVAL', label: 'Aguardando aprovacao' },
  { value: 'APPROVED', label: 'Aprovado' },
  { value: 'REJECTED', label: 'Rejeitado' },
] as const;

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return Number(value) || 0;
  return Number(String(value ?? 0)) || 0;
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function getCustomerName(order: SalesOrderRow): string {
  return order.customer?.name?.trim() || 'Sem cliente';
}

function getMonthKey(value?: string): string {
  if (!value) return 'sem-data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'sem-data';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  if (key === 'sem-data') return 'Sem data';
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '');
}

function getMonthRange(key: string): { fromDate: string; toDate: string } | null {
  if (key === 'sem-data') return null;
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${year}-${String(month).padStart(2, '0')}-01`,
    toDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function buildSalesChart(orders: SalesOrderRow[]) {
  const totalsByCustomer = new Map<string, number>();
  for (const order of orders) {
    const customer = getCustomerName(order);
    totalsByCustomer.set(customer, (totalsByCustomer.get(customer) ?? 0) + toNumber(order.totalAmount));
  }

  const customers: ChartCustomer[] = [...totalsByCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name], index) => ({ name, color: CUSTOMER_COLORS[index % CUSTOMER_COLORS.length] }));

  const customerSet = new Set(customers.map((customer) => customer.name));
  const colorByCustomer = new Map(customers.map((customer) => [customer.name, customer.color]));
  const monthTotals = new Map<string, Map<string, number>>();

  for (const order of orders) {
    const rawCustomer = getCustomerName(order);
    const customer = customerSet.has(rawCustomer) ? rawCustomer : 'Outros clientes';
    if (!colorByCustomer.has(customer)) {
      colorByCustomer.set(customer, CUSTOMER_COLORS[customers.length % CUSTOMER_COLORS.length]);
    }
    const monthKey = getMonthKey(order.orderDate);
    const byCustomer = monthTotals.get(monthKey) ?? new Map<string, number>();
    byCustomer.set(customer, (byCustomer.get(customer) ?? 0) + toNumber(order.totalAmount));
    monthTotals.set(monthKey, byCustomer);
  }

  const months: ChartMonth[] = [...monthTotals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([key, byCustomer]) => {
      const segments = [...byCustomer.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([customer, total]) => ({
          customer,
          total,
          color: colorByCustomer.get(customer) ?? CUSTOMER_COLORS[0],
        }));
      return {
        key,
        label: getMonthLabel(key),
        total: segments.reduce((sum, segment) => sum + segment.total, 0),
        segments,
      };
    });

  const legend = [...colorByCustomer.entries()].map(([name, color]) => ({ name, color }));
  return { months, legend };
}

export function SalesListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [chartCustomer, setChartCustomer] = useState('');
  const [chartMonth, setChartMonth] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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

  const chart = useMemo(() => buildSalesChart(data ?? []), [data]);
  const chartPrimaryCustomers = useMemo(
    () => chart.legend.map((customer) => customer.name).filter((name) => name !== 'Outros clientes'),
    [chart.legend],
  );

  const customerOptions = useMemo(() => {
    const names = new Set((data ?? []).map(getCustomerName));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const visibleOrders = useMemo(() => {
    if (!data?.length) return [];
    const q = search.trim().toLowerCase();
    const min = minAmount.trim() ? Number(minAmount) : null;
    const max = maxAmount.trim() ? Number(maxAmount) : null;
    let rows = data;

    if (statusFilter) {
      rows = rows.filter((order) => order.status === statusFilter);
    }
    if (customerFilter) {
      rows = rows.filter((order) => getCustomerName(order) === customerFilter);
    }
    if (chartCustomer) {
      rows = rows.filter((order) => {
        const customer = getCustomerName(order);
        return chartCustomer === 'Outros clientes'
          ? !chartPrimaryCustomers.includes(customer)
          : customer === chartCustomer;
      });
    }
    if (chartMonth) {
      rows = rows.filter((order) => getMonthKey(order.orderDate) === chartMonth);
    }
    if (min !== null && Number.isFinite(min)) {
      rows = rows.filter((order) => toNumber(order.totalAmount) >= min);
    }
    if (max !== null && Number.isFinite(max)) {
      rows = rows.filter((order) => toNumber(order.totalAmount) <= max);
    }
    if (q) {
      rows = rows.filter(
        (order) =>
          order.number.toLowerCase().includes(q) ||
          getCustomerName(order).toLowerCase().includes(q) ||
          documentStatusMatchesQuery(order.status, q),
      );
    }

    return [...rows].sort((a, b) => {
      const aTime = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const bTime = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      if (aTime !== bTime) return sortDesc ? bTime - aTime : aTime - bTime;
      const cmp = a.number.localeCompare(b.number, undefined, { numeric: true });
      return sortDesc ? -cmp : cmp;
    });
  }, [
    chartCustomer,
    chartMonth,
    chartPrimaryCustomers,
    customerFilter,
    data,
    maxAmount,
    minAmount,
    search,
    sortDesc,
    statusFilter,
  ]);

  const analytics = useMemo(() => {
    const rows = visibleOrders;
    const total = rows.reduce((sum, order) => sum + toNumber(order.totalAmount), 0);
    const average = rows.length ? total / rows.length : 0;
    const byCustomer = new Map<string, number>();
    for (const order of rows) {
      const customer = getCustomerName(order);
      byCustomer.set(customer, (byCustomer.get(customer) ?? 0) + toNumber(order.totalAmount));
    }
    const topCustomer = [...byCustomer.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total,
      average,
      orders: rows.length,
      topCustomerName: topCustomer?.[0] ?? '--',
      topCustomerTotal: topCustomer?.[1] ?? 0,
    };
  }, [visibleOrders]);

  const hasActiveFilters = Boolean(
    search ||
      statusFilter ||
      customerFilter ||
      chartCustomer ||
      chartMonth ||
      fromDate ||
      toDate ||
      minAmount ||
      maxAmount,
  );

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
      setFormError(getApiErrorMessage(e, 'Nao foi possivel criar o pedido.'));
    },
  });

  const mastersLoading = companiesQ.isLoading || customersQ.isLoading;
  const mastersError = companiesQ.error || customersQ.error;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCustomerFilter('');
    setChartCustomer('');
    setChartMonth('');
    setFromDate('');
    setToDate('');
    setMinAmount('');
    setMaxAmount('');
  };

  const applyMonthFilter = (monthKey: string) => {
    const range = getMonthRange(monthKey);
    setChartMonth(monthKey);
    if (range) {
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    } else if (!monthKey) {
      setFromDate('');
      setToDate('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/70 lg:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                Sales professional workspace
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                Vendas - pedidos
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Analise vendas por cliente e mes, filtre documentos e acompanhe a carteira comercial.
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60"
            >
              {createDraft.isPending ? 'A criar...' : 'Novo pedido'}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total filtrado" value={formatCurrencyBrl(analytics.total)} detail={`${analytics.orders} pedidos`} />
            <MetricCard label="Ticket medio" value={formatCurrencyBrl(analytics.average)} detail="media por pedido" />
            <MetricCard
              label="Cliente lider"
              value={analytics.topCustomerName}
              detail={formatCurrencyBrl(analytics.topCustomerTotal)}
            />
            <MetricCard
              label="Base carregada"
              value={String(data?.length ?? 0)}
              detail={hasActiveFilters ? 'com filtros ativos' : 'sem filtros ativos'}
            />
          </div>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[1.4fr_0.85fr] lg:p-5">
          <SalesByCustomerChart
            months={chart.months}
            legend={chart.legend}
            selectedCustomer={chartCustomer}
            selectedMonth={chartMonth}
            onSelectSegment={(customer, month) => {
              setChartCustomer(customer === chartCustomer && month === chartMonth ? '' : customer);
              applyMonthFilter(month === chartMonth && customer === chartCustomer ? '' : month);
            }}
            onSelectCustomer={(customer) => setChartCustomer((current) => (current === customer ? '' : customer))}
            onSelectMonth={applyMonthFilter}
          />

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Novo pedido
              </p>
              <div className="mt-3 grid gap-3">
                <Field label="Empresa" htmlFor="sales-company">
                  <select
                    id="sales-company"
                    data-testid="sales-company-select"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    disabled={mastersLoading || !companiesQ.data?.length}
                  >
                    {(companiesQ.data ?? []).map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cliente" htmlFor="sales-customer">
                  <select
                    id="sales-customer"
                    data-testid="sales-customer-select"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={mastersLoading || !customersQ.data?.length}
                  >
                    {(customersQ.data ?? []).map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Filtros do grafico
                </p>
                {(chartCustomer || chartMonth) && (
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300"
                  onClick={() => {
                    setChartCustomer('');
                    applyMonthFilter('');
                  }}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <FilterPill active={Boolean(chartCustomer)}>{chartCustomer || 'Todos clientes'}</FilterPill>
                <FilterPill active={Boolean(chartMonth)}>{chartMonth ? getMonthLabel(chartMonth) : 'Todos meses'}</FilterPill>
              </div>
            </div>
          </div>
        </div>
      </section>

      {mastersError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Nao foi possivel carregar empresas ou clientes.
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
          Nao foi possivel carregar os pedidos.
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label htmlFor="sales-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pesquisar
            </label>
            <input
              id="sales-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Numero, cliente ou estado"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <Field label="Cliente" htmlFor="sales-filter-customer">
            <select
              id="sales-filter-customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Todos</option>
              {customerOptions.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado" htmlFor="sales-status">
            <select
              id="sales-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Emissao de" htmlFor="sales-from-date">
            <input
              id="sales-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setChartMonth('');
              }}
              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </Field>

          <Field label="Emissao ate" htmlFor="sales-to-date">
            <input
              id="sales-to-date"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setChartMonth('');
              }}
              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </Field>

          <Field label="Total min." htmlFor="sales-min-amount">
            <input
              id="sales-min-amount"
              type="number"
              min="0"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="0"
              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </Field>

          <Field label="Total max." htmlFor="sales-max-amount">
            <input
              id="sales-max-amount"
              type="number"
              min="0"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="99999"
              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {!isLoading && data?.length ? (
              <span>
                {visibleOrders.length} de {data.length} pedidos
              </span>
            ) : (
              <span>A carregar pedidos</span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortDesc((value) => !value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Emissao {sortDesc ? 'desc' : 'asc'}
            </button>
            <SegmentedControl value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </section>

      {viewMode === 'list' ? (
        <SalesTable orders={visibleOrders} isLoading={isLoading} hasAnyOrders={Boolean(data?.length)} />
      ) : (
        <SalesCards orders={visibleOrders} isLoading={isLoading} hasAnyOrders={Boolean(data?.length)} />
      )}
    </div>
  );
}

function SalesByCustomerChart({
  months,
  legend,
  selectedCustomer,
  selectedMonth,
  onSelectSegment,
  onSelectCustomer,
  onSelectMonth,
}: {
  months: ChartMonth[];
  legend: ChartCustomer[];
  selectedCustomer: string;
  selectedMonth: string;
  onSelectSegment: (customer: string, month: string) => void;
  onSelectCustomer: (customer: string) => void;
  onSelectMonth: (month: string) => void;
}) {
  const maxTotal = Math.max(...months.map((month) => month.total), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total de vendas por cliente e mes
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
            Receita mensal por cliente
          </h3>
        </div>
        <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Clique em uma cor para filtrar os documentos abaixo.
        </p>
      </div>

      {months.length ? (
        <>
          <div className="mt-5 flex min-h-72 items-end gap-3 overflow-x-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-950/50">
            {months.map((month) => {
              const barHeight = Math.max(18, (month.total / maxTotal) * 220);
              return (
                <div key={month.key} className="flex min-w-[88px] flex-1 flex-col items-center gap-2">
                  <div className="flex h-60 w-full items-end">
                    <div
                      className={`relative flex w-full flex-col-reverse overflow-hidden rounded-md border bg-white shadow-sm dark:bg-slate-900 ${
                        selectedMonth === month.key
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                      style={{ height: `${barHeight}px` }}
                    >
                      {month.segments.map((segment) => {
                        const height = month.total > 0 ? (segment.total / month.total) * 100 : 0;
                        const active =
                          selectedMonth === month.key &&
                          (!selectedCustomer || selectedCustomer === segment.customer);
                        return (
                          <button
                            key={`${month.key}-${segment.customer}`}
                            type="button"
                            title={`${segment.customer}: ${formatCurrencyBrl(segment.total)}`}
                            className={`w-full transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                              active ? 'brightness-110' : ''
                            }`}
                            style={{
                              height: `${Math.max(height, 4)}%`,
                              backgroundColor: segment.color,
                            }}
                            onClick={() => onSelectSegment(segment.customer, month.key)}
                            aria-label={`Filtrar ${segment.customer} em ${month.label}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectMonth(month.key)}
                    className={`text-xs font-medium ${
                      selectedMonth === month.key
                        ? 'text-blue-600 dark:text-blue-300'
                        : 'text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300'
                    }`}
                  >
                    {month.label}
                  </button>
                  <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {formatCompactCurrency(month.total)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {legend.map((customer) => (
              <button
                key={customer.name}
                type="button"
                onClick={() => onSelectCustomer(customer.name)}
                className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                  selectedCustomer === customer.name
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: customer.color }} />
                <span className="max-w-[15rem] truncate">{customer.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
          Sem dados de vendas para o grafico.
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 truncate text-xl font-semibold tabular-nums text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterPill({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
        active
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {children}
    </span>
  );
}

function SegmentedControl({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
      {(['list', 'cards'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            value === mode
              ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-200'
              : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          {mode === 'list' ? 'Lista' : 'Cards'}
        </button>
      ))}
    </div>
  );
}

function SalesTable({
  orders,
  isLoading,
  hasAnyOrders,
}: {
  orders: SalesOrderRow[];
  isLoading: boolean;
  hasAnyOrders: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Emissao</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                A carregar...
              </td>
            </tr>
          ) : !hasAnyOrders ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Sem pedidos. Crie um rascunho com &quot;Novo pedido&quot;.
              </td>
            </tr>
          ) : !orders.length ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Nenhum pedido corresponde aos filtros.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/60">
                <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                  <Link to={`/sales/${order.id}`} data-testid={`sales-order-link-${order.number}`}>
                    {order.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{getCustomerName(order)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDatePt(order.orderDate)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">
                  {formatCurrencyBrl(order.totalAmount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SalesCards({
  orders,
  isLoading,
  hasAnyOrders,
}: {
  orders: SalesOrderRow[];
  isLoading: boolean;
  hasAnyOrders: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        A carregar...
      </div>
    );
  }
  if (!hasAnyOrders || !orders.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        {hasAnyOrders ? 'Nenhum pedido corresponde aos filtros.' : 'Sem pedidos. Crie um rascunho com "Novo pedido".'}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <Link
          key={order.id}
          to={`/sales/${order.id}`}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-blue-600 dark:text-blue-300">{order.number}</p>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                {getCustomerName(order)}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniValue label="Emissao" value={formatDatePt(order.orderDate)} />
            <MiniValue label="Mes" value={getMonthLabel(getMonthKey(order.orderDate))} />
          </div>
          <div className="mt-5 rounded-md bg-slate-50 px-3 py-3 dark:bg-slate-950/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total do pedido
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950 dark:text-white">
              {formatCurrencyBrl(order.totalAmount)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'CANCELLED' || status === 'REJECTED'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200'
      : status === 'DRAFT'
        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
        : status === 'OPEN' || status === 'RELEASED'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200';

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${tone}`}>
      {formatDocumentStatusPt(status)}
    </span>
  );
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
