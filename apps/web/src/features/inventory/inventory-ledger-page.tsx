import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

type LedgerRow = {
  id: string;
  entryType: string;
  quantity: unknown;
  documentId: string | null;
  item: { sku: string; name: string };
};

type BalanceRow = {
  itemId: string;
  sku: string;
  name: string;
  quantityOnHand: unknown;
};

export function InventoryLedgerPage() {
  const balancesQ = useQuery({
    queryKey: ['inventory-balances'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/inventory/balances');
      return ((envelope as { data?: BalanceRow[] }).data ?? envelope) as BalanceRow[];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-ledger'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/inventory/ledger');
      return ((envelope as { data?: LedgerRow[] }).data ?? envelope) as LedgerRow[];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Estoque — lançamentos</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Últimos movimentos do tenant (inclui libertações de vendas).
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Não foi possível carregar o ledger.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Saldos (soma do ledger)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Usado na validação de stock ao libertar pedidos de venda.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
              <tr>
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Artigo</th>
                <th className="py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {balancesQ.isLoading ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">
                    A carregar…
                  </td>
                </tr>
              ) : !balancesQ.data?.length ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">
                    Sem artigos.
                  </td>
                </tr>
              ) : (
                balancesQ.data.map((b) => (
                  <tr key={b.itemId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="py-2 pr-4">{b.sku}</td>
                    <td className="py-2 pr-4">{b.name}</td>
                    <td className="py-2 text-right tabular-nums">{String(b.quantityOnHand)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  A carregar…
                </td>
              </tr>
            ) : !data?.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Sem lançamentos.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{row.entryType}</td>
                  <td className="px-4 py-3">{row.item.sku}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{String(row.quantity)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
