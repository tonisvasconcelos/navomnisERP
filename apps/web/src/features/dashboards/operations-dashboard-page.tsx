import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';

type OpsSummary = {
  salesTodayAmount: unknown;
  salesTodayCount: number;
  openPurchaseOrders: number;
  uomExceptionCount: number;
  expiringLots7d: number;
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function OperationsDashboardPage() {
  const summary = useQuery({
    queryKey: ['dashboard-ops'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/dashboards/operations/summary');
      return unwrap<OpsSummary>(envelope);
    },
  });

  const fefo = useQuery({
    queryKey: ['dashboard-fefo'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/dashboards/inventory/fefo-risk?days=7');
      return unwrap<unknown[]>(envelope);
    },
  });

  const s = summary.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Operações CADEG</h2>
        <p className="text-sm text-slate-500">Margem, FEFO, variância e exceções UOM.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Vendas hoje (R$)" value={String(s?.salesTodayAmount ?? '…')} />
        <Kpi label="Pedidos abertos (compras)" value={String(s?.openPurchaseOrders ?? '…')} />
        <Kpi label="Lotes a expirar (7d)" value={String(s?.expiringLots7d ?? '…')} />
        <Kpi label="Exceções UOM" value={String(s?.uomExceptionCount ?? '…')} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/uom" className="text-sm text-blue-600 hover:underline">
          UOM master
        </Link>
        <Link to="/approvals" className="text-sm text-blue-600 hover:underline">
          Aprovações
        </Link>
        <Link to="/imports" className="text-sm text-blue-600 hover:underline">
          Import CSV
        </Link>
        <Link to="/exceptions/uom" className="text-sm text-blue-600 hover:underline">
          Fila exceções UOM
        </Link>
      </div>
      <section>
        <h3 className="mb-2 font-medium">Risco FEFO (7 dias)</h3>
        <p className="text-sm text-slate-600">
          {fefo.isLoading ? 'A carregar…' : `${(fefo.data ?? []).length} lotes em risco`}
        </p>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
