import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/shared/api/errors';
import { api } from '@/shared/api/client';

type ItemDetail = {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  baseUom: { id?: string; code: string; name: string };
  primaryImageUrl: string | null;
  quantityOnHand: unknown;
  recentLedger: Array<{
    id: string;
    entryType: string;
    postingDate: string;
    quantity: unknown;
    baseQuantity: unknown;
    transactionUom?: { code: string } | null;
    baseUom?: { code: string } | null;
  }>;
  uomConversions: Array<{
    id: string;
    factor: unknown;
    fromUom: { code: string };
    toUom: { code: string };
  }>;
  openLots: Array<{
    id: string;
    lotNumber: string;
    quantityOnHandKg: unknown;
    expirationDate?: string | null;
  }>;
  supplierItemUoms: Array<{ supplier: { name: string }; purchaseUom: { code: string } }>;
  customerItemUoms: Array<{ customer: { name: string }; saleUom: { code: string } }>;
  valueSummary: { recentEntryCount: number; totalCostAmount: unknown };
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-item', itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data: envelope } = await api.get(`/inventory/items/${itemId}`);
      return unwrap<ItemDetail>(envelope);
    },
  });

  if (!itemId) {
    return <p className="text-sm text-slate-500">Artigo inválido.</p>;
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/inventory')}
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Voltar ao estoque
      </button>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {getApiErrorMessage(error, 'Artigo não encontrado.')}
        </p>
      )}

      {isLoading && <p className="text-sm text-slate-500">A carregar…</p>}

      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
            <div className="flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              {data.primaryImageUrl ? (
                <img
                  src={data.primaryImageUrl}
                  alt={data.name}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <span className="text-xs text-slate-400">Sem imagem</span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{data.name}</h2>
              <p className="mt-1 font-mono text-sm text-slate-500">{data.sku}</p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">UOM base</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {data.baseUom.code} — {data.baseUom.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Saldo</dt>
                  <dd className="font-medium tabular-nums text-slate-900 dark:text-white">
                    {String(data.quantityOnHand)} {data.baseUom.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Estado</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {data.isActive ? 'Ativo' : 'Inativo'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lançamentos recentes</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4 text-right">Qtd trans.</th>
                    <th className="py-2 text-right">Qtd base</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.recentLedger.length ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-slate-500">
                        Sem lançamentos.
                      </td>
                    </tr>
                  ) : (
                    data.recentLedger.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="py-2 pr-4">{new Date(row.postingDate).toLocaleDateString('pt-BR')}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{row.entryType}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {String(row.quantity)} {row.transactionUom?.code ?? ''}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {String(row.baseQuantity ?? row.quantity)} {row.baseUom?.code ?? data.baseUom.code}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conversões UOM</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {!data.uomConversions.length ? (
                <li className="text-slate-500">Sem conversões configuradas.</li>
              ) : (
                data.uomConversions.map((c) => (
                  <li key={c.id}>
                    1 {c.fromUom.code} = {String(c.factor)} {c.toUom.code}
                  </li>
                ))
              )}
            </ul>
          </section>

          {data.openLots.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lotes abertos</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {data.openLots.map((lot) => (
                  <li key={lot.id}>
                    {lot.lotNumber}: {String(lot.quantityOnHandKg)} {data.baseUom.code}
                    {lot.expirationDate
                      ? ` — val. ${new Date(lot.expirationDate).toLocaleDateString('pt-BR')}`
                      : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
