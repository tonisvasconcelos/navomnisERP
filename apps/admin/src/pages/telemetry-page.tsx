import { useQuery } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import { KpiCard } from '@/components/kpi-card';

export function TelemetryPage() {
  const metrics = useQuery({
    queryKey: ['telemetry-metrics'],
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<Record<string, unknown>>>('/platform/telemetry/metrics');
      return res.data.data;
    },
  });
  const health = useQuery({
    queryKey: ['observability-health'],
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<Record<string, unknown>>>('/platform/observability/health');
      return res.data.data;
    },
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-white">Telemetry & health</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Tenants ativos" value={String(metrics.data?.activeTenants ?? '—')} />
        <KpiCard label="API" value={String(health.data?.api ?? '—')} />
        <KpiCard label="Redis" value={String(health.data?.redis ?? '—')} />
      </div>
    </div>
  );
}
