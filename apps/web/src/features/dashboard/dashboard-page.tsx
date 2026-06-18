import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';

type MePayload = {
  email?: string;
  sub?: string;
  tenantId?: string;
  permissions?: string[];
};

type OpsSummary = {
  salesTodayAmount: unknown;
  salesTodayCount: number;
  openPurchaseOrders: number;
  uomExceptionCount: number;
  expiringLots7d: number;
};

type MarginRow = {
  label: string;
  revenue: unknown;
  cost: unknown;
  marginPct: unknown;
};

type PurchaseVarianceRow = {
  orderNumber: string;
  vendor: string;
  item: string;
  poUnitCost: unknown;
  landedCost: unknown;
  variance: unknown;
};

type ReceivingStatus = {
  openPurchaseOrders: number;
  pendingQualityInspections: number;
};

type FefoLot = {
  id?: string;
  lotNumber?: string;
  quantityOnHandKg?: unknown;
  expirationDate?: string;
  item?: { name?: string; sku?: string };
  warehouse?: { name?: string; code?: string };
};

type ShrinkageRow = {
  reason: string;
  _sum?: {
    quantityKg?: unknown;
    costImpact?: unknown;
  };
};

type AgingBuckets = Record<'0-3d' | '4-7d' | '8-14d' | '15d+', number>;

type BarDatum = {
  label: string;
  value: number;
  caption?: string;
  tone?: 'emerald' | 'sky' | 'amber' | 'rose';
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return Number(value) || 0;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const decimal = value as { toNumber: () => number };
    return decimal.toNumber();
  }
  return 0;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatKg(value: unknown) {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(toNumber(value))} kg`;
}

function formatPct(value: unknown) {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(toNumber(value))}%`;
}

function shortDate(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(value),
  );
}

function useDashboardQuery<T>(key: string[], enabled: boolean, url: string) {
  return useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const { data: envelope } = await api.get(url);
      return unwrap<T>(envelope);
    },
  });
}

export function DashboardPage() {
  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const { data: res } = await api.get('/auth/me');
      return unwrap<MePayload>(res);
    },
    staleTime: 60_000,
  });

  const permissions = me.data?.permissions ?? [];
  const can = (code: string) => permissions.includes(code);
  const canFinance = can('finance.read');
  const canPurchases = can('purchases.read');
  const canInventory = can('inventory.read');
  const canMaster = can('master.read');

  const ops = useDashboardQuery<OpsSummary>(
    ['dashboard-ops'],
    canFinance,
    '/dashboards/operations/summary',
  );
  const margin = useDashboardQuery<MarginRow[]>(
    ['dashboard-margin-product'],
    canFinance,
    '/dashboards/margin/by-dimension?dim=product',
  );
  const purchaseVariance = useDashboardQuery<PurchaseVarianceRow[]>(
    ['dashboard-purchase-variance'],
    canPurchases,
    '/dashboards/purchases/variance',
  );
  const receiving = useDashboardQuery<ReceivingStatus>(
    ['dashboard-receiving'],
    canPurchases,
    '/dashboards/receiving/status',
  );
  const fefo = useDashboardQuery<FefoLot[]>(
    ['dashboard-fefo-7'],
    canInventory,
    '/dashboards/inventory/fefo-risk?days=7',
  );
  const aging = useDashboardQuery<AgingBuckets>(
    ['dashboard-inventory-aging'],
    canInventory,
    '/dashboards/inventory/aging',
  );
  const shrinkage = useDashboardQuery<ShrinkageRow[]>(
    ['dashboard-shrinkage'],
    canInventory,
    '/dashboards/inventory/shrinkage',
  );
  const uomExceptions = useDashboardQuery<unknown[]>(
    ['dashboard-uom-exceptions'],
    canMaster,
    '/dashboards/exceptions/uom',
  );

  const salesBars = useMemo<BarDatum[]>(() => {
    return (margin.data ?? [])
      .map((row) => ({
        label: row.label,
        value: toNumber(row.revenue),
        caption: `${formatPct(row.marginPct)} margem`,
        tone: 'emerald' as const,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [margin.data]);

  const purchaseBars = useMemo<BarDatum[]>(() => {
    const byVendor = new Map<string, number>();
    for (const row of purchaseVariance.data ?? []) {
      byVendor.set(row.vendor, (byVendor.get(row.vendor) ?? 0) + toNumber(row.variance));
    }
    return [...byVendor.entries()]
      .map(([label, value]) => ({
        label,
        value: Math.abs(value),
        caption: value >= 0 ? 'acima do pedido' : 'abaixo do pedido',
        tone: value >= 0 ? ('amber' as const) : ('emerald' as const),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [purchaseVariance.data]);

  const marginSummary = useMemo(() => {
    const rows = margin.data ?? [];
    const revenue = rows.reduce((total, row) => total + toNumber(row.revenue), 0);
    const cost = rows.reduce((total, row) => total + toNumber(row.cost), 0);
    return {
      revenue,
      cost,
      marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    };
  }, [margin.data]);

  const fefoKg = useMemo(
    () => (fefo.data ?? []).reduce((total, lot) => total + toNumber(lot.quantityOnHandKg), 0),
    [fefo.data],
  );
  const shrinkageCost = useMemo(
    () =>
      (shrinkage.data ?? []).reduce(
        (total, row) => total + toNumber(row._sum?.costImpact),
        0,
      ),
    [shrinkage.data],
  );
  const totalVariance = useMemo(
    () =>
      (purchaseVariance.data ?? []).reduce((total, row) => total + toNumber(row.variance), 0),
    [purchaseVariance.data],
  );

  const isLoading = me.isLoading || ops.isLoading || margin.isLoading || purchaseVariance.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
            Hortifruti Rio de Janeiro
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Painel executivo
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Vendas, compras, margem, qualidade e giro de estoque para operacao de pereciveis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionLink to="/sales" disabled={!can('sales.read')}>
            Vendas
          </ActionLink>
          <ActionLink to="/purchases" disabled={!canPurchases}>
            Compras
          </ActionLink>
          <ActionLink to="/produce" disabled={!canInventory}>
            Hortifruti
          </ActionLink>
          <ActionLink to="/operations" disabled={!canMaster}>
            Operacoes
          </ActionLink>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Vendas hoje"
          value={canFinance ? formatCurrency(ops.data?.salesTodayAmount) : '--'}
          detail={`${ops.data?.salesTodayCount ?? 0} pedidos emitidos`}
          accent="emerald"
          loading={ops.isLoading}
        />
        <KpiCard
          label="Margem media"
          value={canFinance ? formatPct(marginSummary.marginPct) : '--'}
          detail={`${formatCompactCurrency(marginSummary.revenue)} receita analisada`}
          accent="sky"
          loading={margin.isLoading}
        />
        <KpiCard
          label="Compras abertas"
          value={canPurchases ? String(receiving.data?.openPurchaseOrders ?? 0) : '--'}
          detail={`${receiving.data?.pendingQualityInspections ?? 0} inspecoes de qualidade`}
          accent="amber"
          loading={receiving.isLoading}
        />
        <KpiCard
          label="Risco FEFO 7d"
          value={canInventory ? String(ops.data?.expiringLots7d ?? fefo.data?.length ?? 0) : '--'}
          detail={`${formatKg(fefoKg)} a priorizar`}
          accent="rose"
          loading={fefo.isLoading}
        />
        <KpiCard
          label="Excecoes"
          value={canMaster ? String(uomExceptions.data?.length ?? ops.data?.uomExceptionCount ?? 0) : '--'}
          detail={`${formatCurrency(shrinkageCost)} perdas registradas`}
          accent="slate"
          loading={uomExceptions.isLoading || shrinkage.isLoading}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <Panel
          title="Vendas por produto"
          eyebrow="Receita e margem"
          action={
            <Link className="text-xs font-medium text-sky-600 hover:text-sky-500" to="/sales">
              Ver pedidos
            </Link>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
            <HorizontalBars
              data={salesBars}
              emptyLabel={canFinance ? 'Sem vendas para exibir.' : 'Sem permissao financeira.'}
              valueFormatter={formatCompactCurrency}
            />
            <MarginGauge revenue={marginSummary.revenue} cost={marginSummary.cost} />
          </div>
        </Panel>

        <Panel
          title="Compras e variacao de custo"
          eyebrow="Fornecedor x custo recebido"
          action={
            <Link className="text-xs font-medium text-sky-600 hover:text-sky-500" to="/purchases">
              Ver compras
            </Link>
          }
        >
          <HorizontalBars
            data={purchaseBars}
            emptyLabel={canPurchases ? 'Sem variacao de compra registrada.' : 'Sem permissao de compras.'}
            valueFormatter={formatCompactCurrency}
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="Variacao liquida" value={formatCurrency(totalVariance)} />
            <MiniMetric
              label="Linhas analisadas"
              value={String(purchaseVariance.data?.length ?? 0)}
            />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Giro de estoque" eyebrow="Idade dos lotes">
          <StackedAging buckets={aging.data} loading={aging.isLoading} />
        </Panel>

        <Panel
          title="Prioridade FEFO"
          eyebrow="Lotes com vencimento proximo"
          action={
            <Link className="text-xs font-medium text-sky-600 hover:text-sky-500" to="/inventory">
              Ver estoque
            </Link>
          }
        >
          <FefoList lots={fefo.data ?? []} loading={fefo.isLoading} />
        </Panel>

        <Panel title="Fila operacional" eyebrow="Pontos de controle">
          <div className="space-y-3">
            <QueueItem
              label="Pedidos de compra abertos"
              value={receiving.data?.openPurchaseOrders ?? ops.data?.openPurchaseOrders ?? 0}
              to="/purchases"
              tone="amber"
            />
            <QueueItem
              label="Inspecoes de qualidade"
              value={receiving.data?.pendingQualityInspections ?? 0}
              to="/produce"
              tone="sky"
            />
            <QueueItem
              label="Excecoes UOM"
              value={uomExceptions.data?.length ?? ops.data?.uomExceptionCount ?? 0}
              to="/exceptions/uom"
              tone="rose"
            />
          </div>
        </Panel>
      </section>

      {isLoading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">A carregar indicadores...</p>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  accent,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  accent: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
  loading?: boolean;
}) {
  const accentClass = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
  }[accent];

  return (
    <article className="min-h-32 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${accentClass}`} aria-hidden />
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
        {loading ? '...' : value}
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </article>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HorizontalBars({
  data,
  emptyLabel,
  valueFormatter,
}: {
  data: BarDatum[];
  emptyLabel: string;
  valueFormatter: (value: number) => string;
}) {
  const max = Math.max(...data.map((item) => item.value), 0);
  const toneClass = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  if (data.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = max > 0 ? Math.max(7, (item.value / max) * 100) : 0;
        return (
          <div key={`${item.label}-${item.caption}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                {valueFormatter(item.value)}
              </span>
            </div>
            <div className="h-8 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={`flex h-full items-center rounded-md px-2 text-[11px] font-medium text-white ${
                  toneClass[item.tone ?? 'emerald']
                }`}
                style={{ width: `${width}%` }}
              >
                <span className="truncate">{item.caption}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarginGauge({ revenue, cost }: { revenue: number; cost: number }) {
  const margin = Math.max(revenue - cost, 0);
  const costPct = revenue > 0 ? Math.min(100, (cost / revenue) * 100) : 0;
  const marginPct = revenue > 0 ? Math.max(0, (margin / revenue) * 100) : 0;

  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Composicao
      </p>
      <div className="mt-4 h-44">
        <svg viewBox="0 0 180 180" className="h-full w-full" role="img" aria-label="Receita, custo e margem">
          <circle cx="90" cy="90" r="68" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="18" />
          <circle
            cx="90"
            cy="90"
            r="68"
            fill="none"
            stroke="currentColor"
            className="text-emerald-500"
            strokeDasharray={`${marginPct * 4.27} 427`}
            strokeLinecap="round"
            strokeWidth="18"
            transform="rotate(-90 90 90)"
          />
          <text x="90" y="84" textAnchor="middle" className="fill-slate-950 text-2xl font-semibold dark:fill-white">
            {Math.round(marginPct)}%
          </text>
          <text x="90" y="108" textAnchor="middle" className="fill-slate-500 text-xs">
            margem
          </text>
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MiniMetric label="Receita" value={formatCompactCurrency(revenue)} />
        <MiniMetric label="Custo" value={formatCompactCurrency((costPct / 100) * revenue)} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function StackedAging({ buckets, loading }: { buckets?: AgingBuckets; loading?: boolean }) {
  const values = buckets ?? { '0-3d': 0, '4-7d': 0, '8-14d': 0, '15d+': 0 };
  const rows = [
    { label: '0-3 dias', value: values['0-3d'], className: 'bg-emerald-500' },
    { label: '4-7 dias', value: values['4-7d'], className: 'bg-sky-500' },
    { label: '8-14 dias', value: values['8-14d'], className: 'bg-amber-500' },
    { label: '15+ dias', value: values['15d+'], className: 'bg-rose-500' },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">A carregar estoque...</p>;
  }

  return (
    <div>
      <div className="flex h-10 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.className}
            style={{ width: `${total > 0 ? (row.value / total) * 100 : 25}%` }}
            aria-label={`${row.label}: ${formatKg(row.value)}`}
          />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${row.className}`} aria-hidden />
              {row.label}
            </span>
            <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {formatKg(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FefoList({ lots, loading }: { lots: FefoLot[]; loading?: boolean }) {
  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">A carregar lotes...</p>;
  if (lots.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum lote em risco nos proximos 7 dias.</p>;
  }

  return (
    <div className="space-y-3">
      {lots.slice(0, 5).map((lot, index) => (
        <div
          key={lot.id ?? `${lot.lotNumber}-${index}`}
          className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {lot.item?.name ?? lot.item?.sku ?? 'Item'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Lote {lot.lotNumber ?? '--'} · {lot.warehouse?.name ?? lot.warehouse?.code ?? 'sem deposito'}
              </p>
            </div>
            <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              {shortDate(lot.expirationDate)}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
            {formatKg(lot.quantityOnHandKg)}
          </p>
        </div>
      ))}
    </div>
  );
}

function QueueItem({
  label,
  value,
  to,
  tone,
}: {
  label: string;
  value: number;
  to: string;
  tone: 'amber' | 'sky' | 'rose';
}) {
  const toneClass = {
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
  }[tone];

  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3 transition hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-700"
    >
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className={`rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
      </span>
    </Link>
  );
}

function ActionLink({
  to,
  disabled,
  children,
}: {
  to: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-400 dark:border-slate-700">
        {children}
      </span>
    );
  }

  return (
    <Link
      to={to}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
    >
      {children}
    </Link>
  );
}
