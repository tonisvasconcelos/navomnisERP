import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

type Exception = { id: string; message: string; context: string; createdAt: string };

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function UomExceptionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['uom-exceptions'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/dashboards/exceptions/uom');
      return unwrap<Exception[]>(envelope);
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Exceções UOM</h2>
      <ul className="divide-y rounded-xl border dark:divide-slate-800 dark:border-slate-800">
        {isLoading ? (
          <li className="p-4 text-slate-500">A carregar…</li>
        ) : !(data ?? []).length ? (
          <li className="p-4 text-slate-500">Sem exceções abertas.</li>
        ) : (
          (data ?? []).map((e) => (
            <li key={e.id} className="p-4 text-sm">
              <span className="font-medium">{e.context}</span> — {e.message}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
