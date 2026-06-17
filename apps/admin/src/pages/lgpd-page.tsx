import { useQuery } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import { DataTable } from '@/components/data-table';

type ConsentRow = { kind: string; version: string; _count: { id: number } };
type RequestRow = { id: string; requestType: string; status: string; tenantId: string };

export function LgpdPage() {
  const consents = useQuery({
    queryKey: ['lgpd-consents'],
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<{ kind: string; version: string; _count: { id: number } }[]>>(
        '/platform/lgpd/consents/overview',
      );
      return res.data.data;
    },
  });
  const requests = useQuery({
    queryKey: ['lgpd-requests'],
    queryFn: async () => {
      const res = await platformApi.get<
        ApiEnvelope<{ id: string; requestType: string; status: string; tenantId: string }[]>
      >('/platform/lgpd/requests');
      return res.data.data;
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Consent overview</h2>
        {consents.isLoading ? (
          <p className="text-slate-400">Carregando…</p>
        ) : (
          <DataTable<ConsentRow>
            columns={['Tipo', 'Versão', 'Aceites']}
            rows={consents.data ?? []}
            rowKey={(c) => `${c.kind}-${c.version}`}
            getCells={(c) => [c.kind, c.version, c._count.id]}
          />
        )}
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Data subject requests</h2>
        {requests.isLoading ? (
          <p className="text-slate-400">Carregando…</p>
        ) : (
          <DataTable<RequestRow>
            columns={['ID', 'Tipo', 'Status', 'Tenant']}
            rows={requests.data ?? []}
            rowKey={(r) => r.id}
            getCells={(r) => [r.id.slice(0, 8), r.requestType, r.status, r.tenantId.slice(0, 8)]}
          />
        )}
      </section>
    </div>
  );
}
