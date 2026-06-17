import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

type UomUnit = { id: string; code: string; name: string; kind: string };

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function UomMasterPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['uom-units'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/uom/units');
      return unwrap<UomUnit[]>(envelope);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Unidades de medida</h2>
        <p className="text-sm text-slate-500">Cadastro CADEG — KG, UN, CX, BDJ, etc.</p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Erro ao carregar UOM.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 text-left">Código</th>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-slate-500">
                  A carregar…
                </td>
              </tr>
            ) : (
              (data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono">{u.code}</td>
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.kind}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
