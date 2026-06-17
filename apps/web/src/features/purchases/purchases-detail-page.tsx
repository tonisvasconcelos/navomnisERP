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
  vendor?: { name: string };
  lines: {
    id: string;
    quantity: unknown;
    unitCost: unknown;
    lineTotal: unknown;
    item: { sku: string; name: string };
  }[];
};

type ItemRow = { id: string; sku: string; name: string };

type LineForm = { quantity: string; unitCost: string };

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

function canReceive(status: string) {
  return status === 'OPEN' || status === 'RELEASED' || status === 'PARTIALLY_RECEIVED';
}

export function PurchasesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [itemId, setItemId] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');
  const { register, handleSubmit, reset } = useForm<LineForm>({
    defaultValues: { quantity: '1', unitCost: '10' },
  });

  const itemsQ = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/inventory/items');
      return unwrap<ItemRow[]>(envelope);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data: envelope } = await api.get(`/purchases/orders/${id}`);
      return unwrap<OrderDetail>(envelope);
    },
  });

  useEffect(() => {
    if (itemsQ.data?.length && !itemId) {
      const preferred = itemsQ.data.find((i) => i.sku === 'ITEM-001') ?? itemsQ.data[0];
      setItemId(preferred.id);
    }
  }, [itemsQ.data, itemId]);

  useEffect(() => {
    if (data?.lines?.length && receiveModalOpen) {
      const initial: Record<string, string> = {};
      for (const line of data.lines) {
        initial[line.id] = String(line.quantity);
      }
      setReceiveQtys(initial);
    }
  }, [data?.lines, receiveModalOpen]);

  const addLine = useMutation({
    mutationFn: async (values: LineForm) => {
      if (!itemId) throw new Error('Selecione um artigo.');
      await api.post(`/purchases/orders/${id}/lines`, {
        itemId,
        quantity: values.quantity,
        unitCost: values.unitCost,
      });
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['purchase-order', id] });
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      reset({ quantity: '1', unitCost: '10' });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível adicionar a linha.'));
    },
  });

  const removeLine = useMutation({
    mutationFn: async (lineId: string) => {
      await api.delete(`/purchases/orders/${id}/lines/${lineId}`);
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['purchase-order', id] });
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível remover a linha.'));
    },
  });

  const updateLine = useMutation({
    mutationFn: async ({
      lineId,
      quantity,
      unitCost,
    }: {
      lineId: string;
      quantity: string;
      unitCost: string;
    }) => {
      await api.patch(`/purchases/orders/${id}/lines/${lineId}`, { quantity, unitCost });
    },
    onSuccess: async () => {
      setApiError(null);
      setEditingLineId(null);
      await qc.invalidateQueries({ queryKey: ['purchase-order', id] });
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível atualizar a linha.'));
    },
  });

  const submitApproval = useMutation({
    mutationFn: async () => {
      await api.post(`/purchases/orders/${id}/submit-approval`);
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível submeter para aprovação.'));
    },
  });

  const release = useMutation({
    mutationFn: async () => {
      await api.post(`/purchases/orders/${id}/release`);
    },
    onSuccess: async () => {
      setApiError(null);
      await qc.invalidateQueries({ queryKey: ['purchase-order', id] });
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível libertar o pedido.'));
    },
  });

  const receive = useMutation({
    mutationFn: async () => {
      const lines = Object.entries(receiveQtys)
        .filter(([, qty]) => qty.trim() && Number(qty) > 0)
        .map(([lineId, quantity]) => ({ lineId, quantity }));
      if (!lines.length) throw new Error('Indique quantidades a receber.');
      await api.post(`/purchases/orders/${id}/receive`, { lines });
    },
    onSuccess: async () => {
      setApiError(null);
      setReceiveModalOpen(false);
      await qc.invalidateQueries({ queryKey: ['purchase-order', id] });
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      await qc.invalidateQueries({ queryKey: ['inventory-ledger'] });
      await qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    },
    onError: (e: unknown) => {
      setApiError(getApiErrorMessage(e, 'Não foi possível registar a receção.'));
    },
  });

  if (!id) {
    return <p className="text-sm text-slate-500">Pedido inválido.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/purchases')}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Voltar à lista
        </button>
        <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white" data-testid="purchase-order-title">
          {isLoading ? 'A carregar…' : data?.number ?? 'Pedido'}
        </h2>
        {data && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.vendor?.name} · <span data-testid="purchase-order-status">{data.status}</span>
          </p>
        )}
      </div>

      {apiError && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          data-testid="purchases-detail-error"
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
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="purchase-line-item">
              Artigo
            </label>
            <select
              id="purchase-line-item"
              data-testid="purchase-line-item"
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
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="purchase-qty">
              Quantidade
            </label>
            <input
              id="purchase-qty"
              data-testid="purchase-line-qty"
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              {...register('quantity')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="purchase-cost">
              Custo unit.
            </label>
            <input
              id="purchase-cost"
              data-testid="purchase-line-cost"
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              {...register('unitCost')}
            />
          </div>
          <button
            type="submit"
            data-testid="purchase-add-line"
            disabled={addLine.isPending || !itemId}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
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
              <th className="px-4 py-3 text-right">Custo</th>
              <th className="px-4 py-3 text-right">Total</th>
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
                          className="w-24 rounded border px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-950"
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
                          className="w-24 rounded border px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-950"
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value)}
                        />
                      ) : (
                        String(l.unitCost)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{String(l.lineTotal)}</td>
                    {data.status === 'DRAFT' ? (
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:underline"
                              disabled={updateLine.isPending}
                              onClick={() =>
                                updateLine.mutate({
                                  lineId: l.id,
                                  quantity: editQty,
                                  unitCost: editCost,
                                })
                              }
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className="text-xs text-slate-500 hover:underline"
                              onClick={() => setEditingLineId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => {
                                setEditingLineId(l.id);
                                setEditQty(String(l.quantity));
                                setEditCost(String(l.unitCost));
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              disabled={removeLine.isPending}
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

      <div className="flex flex-wrap gap-3">
        {data?.status === 'DRAFT' && (
          <button
            type="button"
            disabled={submitApproval.isPending || !data.lines.length}
            onClick={() => submitApproval.mutate()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Submeter aprovação
          </button>
        )}
        {(data?.status === 'DRAFT' || data?.status === 'APPROVED') && (
          <button
            type="button"
            data-testid="purchase-release"
            disabled={release.isPending || !data.lines.length}
            onClick={() => setReleaseModalOpen(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {release.isPending ? 'A libertar…' : 'Libertar pedido'}
          </button>
        )}
        {data && canReceive(data.status) && (
          <button
            type="button"
            data-testid="purchase-receive"
            disabled={receive.isPending || !data.lines.length}
            onClick={() => {
              setApiError(null);
              setReceiveModalOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Registar receção
          </button>
        )}
      </div>

      <ConfirmDialog
        open={releaseModalOpen}
        title="Libertar pedido de compra"
        description="O pedido ficará aberto para receção de stock. Continuar?"
        confirmLabel="Libertar"
        confirmTestId="purchase-release-confirm"
        isLoading={release.isPending}
        onCancel={() => setReleaseModalOpen(false)}
        onConfirm={() => {
          release.mutate(undefined, { onSettled: () => setReleaseModalOpen(false) });
        }}
      />

      {receiveModalOpen && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receive-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h3 id="receive-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Receção — {data.number}
            </h3>
            <p className="mt-1 text-sm text-slate-500">Quantidades a entrar em stock por linha.</p>
            <ul className="mt-4 space-y-3">
              {data.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {l.item.sku} — pedido {String(l.quantity)}
                  </span>
                  <input
                    type="text"
                    data-testid={`receive-qty-${l.id}`}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-right dark:border-slate-600 dark:bg-slate-950"
                    value={receiveQtys[l.id] ?? ''}
                    onChange={(e) =>
                      setReceiveQtys((prev) => ({ ...prev, [l.id]: e.target.value }))
                    }
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
                onClick={() => setReceiveModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="purchase-receive-confirm"
                disabled={receive.isPending}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-60"
                onClick={() => receive.mutate()}
              >
                {receive.isPending ? 'A registar…' : 'Confirmar receção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
