import { useQuery } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import { DataTable } from '@/components/data-table';

type Log = { action: string; entityType: string; createdAt: string; targetTenantId?: string };

export function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit'],
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<Log[]>>('/platform/audit/logs');
      return res.data.data;
    },
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-white">Platform audit log</h2>
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <DataTable<Log>
          columns={['Ação', 'Entidade', 'Tenant alvo', 'Data']}
          rows={data ?? []}
          rowKey={(l) => `${l.action}-${l.entityType}-${l.createdAt}`}
          getCells={(l) => [
            l.action,
            l.entityType,
            l.targetTenantId?.slice(0, 8) ?? '—',
            new Date(l.createdAt).toLocaleString('pt-BR'),
          ]}
        />
      )}
    </div>
  );
}
