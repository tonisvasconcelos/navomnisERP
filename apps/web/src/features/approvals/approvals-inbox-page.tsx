import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';

type InboxRow = {
  id: string;
  documentId: string;
  status: string;
  requestedAt: string;
  canAct: boolean;
  document?: { number: string; totalAmount: unknown; vendor?: { name: string } };
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function ApprovalsInboxPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['approvals-inbox'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/approvals/inbox');
      return unwrap<InboxRow[]>(envelope);
    },
  });

  const approve = useMutation({
    mutationFn: (orderId: string) => api.post(`/purchases/orders/${orderId}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals-inbox'] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Caixa de aprovações</h2>
      {error && <p className="text-sm text-red-600">Erro ao carregar inbox.</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 text-left">Pedido</th>
              <th className="px-4 py-2 text-left">Fornecedor</th>
              <th className="px-4 py-2 text-left">Valor</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  A carregar…
                </td>
              </tr>
            ) : !(data ?? []).length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  Sem aprovações pendentes.
                </td>
              </tr>
            ) : (
              (data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2">
                    <Link to={`/purchases/${row.documentId}`} className="text-blue-600 hover:underline">
                      {row.document?.number ?? row.documentId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{row.document?.vendor?.name ?? '—'}</td>
                  <td className="px-4 py-2 tabular-nums">{String(row.document?.totalAmount ?? '—')}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2">
                    {row.canAct && (
                      <button
                        type="button"
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500"
                        onClick={() => approve.mutate(row.documentId)}
                      >
                        Aprovar
                      </button>
                    )}
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
