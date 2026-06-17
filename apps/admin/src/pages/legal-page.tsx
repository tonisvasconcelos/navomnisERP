import { useQuery } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import { DataTable } from '@/components/data-table';

type Doc = { kind: string; version: string; status: string; isMandatory: boolean };

export function LegalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['legal-docs'],
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<Doc[]>>('/platform/legal/documents');
      return res.data.data;
    },
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-white">Legal documents</h2>
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <DataTable<Doc>
          columns={['Tipo', 'Versão', 'Status', 'Obrigatório']}
          rows={data ?? []}
          rowKey={(d) => `${d.kind}-${d.version}`}
          getCells={(d) => [d.kind, d.version, d.status, d.isMandatory ? 'Sim' : 'Não']}
        />
      )}
    </div>
  );
}
