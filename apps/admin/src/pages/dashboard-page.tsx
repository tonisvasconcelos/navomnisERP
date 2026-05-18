import { useQuery } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import { KpiCard } from '@/components/kpi-card';

type Metrics = {
  activeTenants: number;
  activeUsers: number;
  events24h: number;
};

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<Metrics>>('/platform/telemetry/metrics');
      return res.data.data;
    },
  });

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-white">Dashboard</h2>
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Tenants ativos" value={data?.activeTenants ?? 0} />
          <KpiCard label="Usuários" value={data?.activeUsers ?? 0} />
          <KpiCard label="Eventos (24h)" value={data?.events24h ?? 0} />
          <KpiCard label="Status API" value="OK" />
        </div>
      )}
    </div>
  );
}
