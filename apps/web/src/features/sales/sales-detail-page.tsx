import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/shared/api/errors';
import { useForm } from 'react-hook-form';
import { api } from '@/shared/api/client';
import { ConfirmDialog } from '@/widgets/confirm-dialog';

type OrderDetail = {
  id: string;
  number: string;
  status: string;
  totalAmount: unknown;
  customer?: { name: string };
  lines: {
    id: string;
    quantity: unknown;
    unitPrice: unknown;
    lineTotal: unknown;
    item: { sku: string; name: string };
  }[];
};

type ItemRow = { id: string; sku: string; name: string };

type LineForm = { quantity: string; unitPrice: string };

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function SalesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [itemId, setItemId] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const { register, handleSubmit, reset } = useForm<LineForm>({
    defaultValues: { quantity: '1', unitPrice: '10' },
  });

  const itemsQ = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/inventory/items');
      return unwrap<ItemRow[]>(envelope);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-order', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data: envelope } = await api.get(`/sales/orders/${id}`);
      return unwrap<OrderDetail>(envelope);
    },
  });

  useEffect(() => {
    if (itemsQ.data?.length && !itemId) {
      const preferred = itemsQ.data.find((i) => i.sku === 'ITEM-001') ?? itemsQ.data[0];
      setItemId(preferred.id);
    }
  }, [itemsQ.data, itemId]);

  const addLine = useMutation({
    mutationFn: async (values: LineForm) => {
      if (!itemId) {
        throw new Error('Selecione um artigo.');
      }
      await api.post(`/sales/orders/${id}/lines`, {
        itemId,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
      });
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['sales-order', id] });
      await qc.invalidateQueries({ queryKey: ['sales-orders'] });
      reset({ quantity: '1', unitPrice: '10' });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível adicionar a linha.'));
    },
  });

  const removeLine = useMutation({
    mutationFn: async (lineId: string) => {
      await api.delete(`/sales/orders/${id}/lines/${lineId}`);
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['sales-order', id] });
      await qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível remover a linha.'));
    },
  });

  const updateLine = useMutation({
    mutationFn: async ({ lineId, quantity, unitPrice }: { lineId: string; quantity: string; unitPrice: string }) => {
      await api.patch(`/sales/orders/${id}/lines/${lineId}`, { quantity, unitPrice });
    },
    onSuccess: async () => {
      setApiError(null);
      setEditingLineId(null);
      await qc.invalidateQueries({ queryKey: ['sales-order', id] });
      await qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível atualizar a linha.'));
    },
  });

  const release = useMutation({
    mutationFn: async () => {
      await api.post(`/sales/orders/${id}/release`);
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['sales-order', id] });
      await qc.invalidateQueries({ queryKey: ['sales-orders'] });
      await qc.invalidateQueries({ queryKey: ['inventory-ledger'] });
      await qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível libertar o pedido.'));
    },
  });

  const handleReleaseClick = () => {
    setReleaseModalOpen(true);
  };

  const confirmRelease = () => {
    setApiError(null);
    release.mutate(undefined, {
      onSettled: () => setReleaseModalOpen(false),
    });
  };

  if (!id) {
    return <p className="text-sm text-slate-500">Pedido inválido.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/sales')}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Voltar à lista
        </button>
        <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white" data-testid="sales-order-title">
          {isLoading ? 'A carregar…' : data?.number ?? 'Pedido'}
        </h2>
        {data && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.customer?.name} · <span data-testid="sales-order-status">{data.status}</span>
          </p>
        )}
      </div>

      {apiError && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          data-testid="sales-detail-error"
        >
          {apiError}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {getApiErrorMessage(error, 'Pedido não encontrado ou sem permissão.')}
        </p>
      )}

      {data?.status === 'DRAFT' && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleSubmit((v) => addLine.mutate(v))}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="sales-line-item">
              Artigo
            </label>
            <select
              id="sales-line-item"
              data-testid="sales-line-item"
              className="min-w-[12rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              disabled={itemsQ.isLoading || !itemsQ.data?.length}
            >
              {(itemsQ.data ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} — {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="qty">
              Quantidade
            </label>
            <input
              id="qty"
              data-testid="sales-line-qty"
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              {...register('quantity')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="price">
              Preço unit.
            </label>
            <input
              id="price"
              data-testid="sales-line-price"
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              {...register('unitPrice')}
            />
          </div>
          <button
            type="submit"
            data-testid="sales-add-line"
            disabled={addLine.isPending || !itemId}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            {addLine.isPending ? 'A guardar…' : 'Adicionar linha'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Artigo</th>
              <th className="px-4 py-3 text-right">Qtd</th>
              <th className="px-4 py-3 text-right">Preço</th>
              <th className="px-4 py-3 text-right">Total linha</th>
              {data?.status === 'DRAFT' ? <th className="px-4 py-3 text-right">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {!data?.lines?.length ? (
              <tr>
                <td colSpan={data?.status === 'DRAFT' ? 6 : 5} className="px-4 py-4 text-center text-slate-500">
                  Sem linhas.
                </td>
              </tr>
            ) : (
              data.lines.map((l) => {
                const editing = data.status === 'DRAFT' && editingLineId === l.id;
                return (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3">{l.item.sku}</td>
                    <td className="px-4 py-3">{l.item.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {editing ? (
                        <input
                          data-testid="sales-line-edit-qty"
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                        />
                      ) : (
                        String(l.quantity)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {editing ? (
                        <input
                          data-testid="sales-line-edit-price"
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                        />
                      ) : (
                        String(l.unitPrice)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{String(l.lineTotal)}</td>
                    {data.status === 'DRAFT' ? (
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              data-testid="sales-line-edit-save"
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                              disabled={updateLine.isPending}
                              onClick={() =>
                                updateLine.mutate({
                                  lineId: l.id,
                                  quantity: editQty,
                                  unitPrice: editPrice,
                                })
                              }
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className="text-xs text-slate-500 hover:underline dark:text-slate-400"
                              disabled={updateLine.isPending}
                              onClick={() => setEditingLineId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                              disabled={Boolean(editingLineId) && editingLineId !== l.id}
                              onClick={() => {
                                setEditingLineId(l.id);
                                setEditQty(String(l.quantity));
                                setEditPrice(String(l.unitPrice));
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline dark:text-red-400"
                              disabled={removeLine.isPending || Boolean(editingLineId)}
                              onClick={() => removeLine.mutate(l.id)}
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data?.status === 'DRAFT' && (
        <button
          type="button"
          data-testid="sales-release"
          disabled={release.isPending || !data.lines.length}
          onClick={handleReleaseClick}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {release.isPending ? 'A libertar…' : 'Libertar pedido'}
        </button>
      )}

      <ConfirmDialog
        open={releaseModalOpen}
        title="Libertar pedido"
        description="Libertar o pedido aplica movimentos de stock (saída) e não pode ser desfeito nesta versão. Continuar?"
        confirmLabel="Libertar"
        confirmTestId="release-confirm"
        isLoading={release.isPending}
        onCancel={() => setReleaseModalOpen(false)}
        onConfirm={confirmRelease}
      />
    </div>
  );
}
