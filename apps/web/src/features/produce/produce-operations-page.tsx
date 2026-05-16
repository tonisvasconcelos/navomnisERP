import { FormEvent, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';

type Summary = {
  profiles: number;
  lots: number;
  expiringLots: number;
  quarantinedLots: number;
  pendingInspections: number;
  totalLossKg: unknown;
  totalLossCost: unknown;
  readinessWarnings: string[];
};
type ItemRow = { id: string; sku: string; name: string };
type LotRow = {
  id: string;
  lotNumber: string;
  quantityOnHandKg: unknown;
  expirationDate: string | null;
  status: string;
  qualityGrade: string | null;
  item: { sku: string; name: string };
  warehouse?: { code: string; name: string } | null;
  zone?: { code: string; name: string; type: string } | null;
};
type WarehouseRow = { id: string; code: string; name: string };

type Tab = 'profiles' | 'lots' | 'quality' | 'losses' | 'routes';

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function ProduceOperationsPage() {
  const [tab, setTab] = useState<Tab>('lots');
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const summaryQ = useQuery({
    queryKey: ['produce-summary'],
    queryFn: async () => unwrap<Summary>((await api.get('/produce/summary')).data),
  });
  const lotsQ = useQuery({
    queryKey: ['produce-lots'],
    queryFn: async () => unwrap<LotRow[]>((await api.get('/produce/lots')).data),
  });
  const riskQ = useQuery({
    queryKey: ['produce-expiration-risk'],
    queryFn: async () => unwrap<LotRow[]>((await api.get('/produce/expiration-risk?days=7')).data),
  });
  const itemsQ = useQuery({
    queryKey: ['produce-items'],
    queryFn: async () => unwrap<ItemRow[]>((await api.get('/inventory/items')).data),
  });
  const warehousesQ = useQuery({
    queryKey: ['produce-warehouses'],
    queryFn: async () => unwrap<WarehouseRow[]>((await api.get('/produce/warehouses')).data),
  });

  const fields = useMemo(() => buildFields(tab, itemsQ.data ?? [], warehousesQ.data ?? [], lotsQ.data ?? []), [tab, itemsQ.data, warehousesQ.data, lotsQ.data]);
  const endpoint = endpointFor(tab);

  const create = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      const { data } = await api.post(endpoint, payload);
      return data;
    },
    onSuccess: async () => {
      setForm({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['produce-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['produce-lots'] }),
        queryClient.invalidateQueries({ queryKey: ['produce-expiration-risk'] }),
      ]);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Hortifruti RJ</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Operacao com peso variavel, lotes, validade, qualidade, perdas, custo e entrega.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Metric label="Perfis" value={summaryQ.data?.profiles ?? 0} />
        <Metric label="Lotes" value={summaryQ.data?.lots ?? 0} />
        <Metric label="Vencem 7d" value={summaryQ.data?.expiringLots ?? 0} tone="amber" />
        <Metric label="Quarentena" value={summaryQ.data?.quarantinedLots ?? 0} tone="amber" />
        <Metric label="Inspecoes" value={summaryQ.data?.pendingInspections ?? 0} />
        <Metric label="Perda kg" value={String(summaryQ.data?.totalLossKg ?? 0)} tone="red" />
      </section>

      {summaryQ.data?.readinessWarnings?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {summaryQ.data.readinessWarnings.join(' ')}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(20rem,28rem)_1fr]">
        <form className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" onSubmit={submit}>
          <div className="flex flex-wrap gap-2">
            {(['profiles', 'lots', 'quality', 'losses', 'routes'] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTab(item);
                  setForm({});
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  tab === item
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200'
                }`}
              >
                {tabLabel(item)}
              </button>
            ))}
          </div>
          {fields.map((field) =>
            field.options ? (
              <SelectField
                key={field.name}
                label={field.label}
                value={form[field.name] ?? ''}
                options={field.options}
                required={field.required}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
              />
            ) : (
              <TextField
                key={field.name}
                label={field.label}
                value={form[field.name] ?? ''}
                required={field.required}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
              />
            ),
          )}
          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {create.isPending ? 'Salvando...' : 'Salvar'}
          </button>
          {create.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {getApiErrorMessage(create.error, 'Nao foi possivel salvar.')}
            </p>
          ) : null}
        </form>

        <div className="space-y-4">
          <Panel title="Risco FEFO / validade">
            <LotTable rows={riskQ.data ?? []} empty="Sem risco de vencimento nos proximos 7 dias." />
          </Panel>
          <Panel title="Lotes operacionais">
            <LotTable rows={lotsQ.data ?? []} empty="Nenhum lote recebido." />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function endpointFor(tab: Tab) {
  if (tab === 'profiles') return '/produce/profiles';
  if (tab === 'quality') return '/produce/quality-inspections';
  if (tab === 'losses') return '/produce/losses';
  if (tab === 'routes') return '/produce/routes';
  return '/produce/lots';
}

function tabLabel(tab: Tab) {
  return {
    profiles: 'Perfil item',
    lots: 'Receber lote',
    quality: 'Qualidade',
    losses: 'Perda',
    routes: 'Rota',
  }[tab];
}

function buildFields(tab: Tab, items: ItemRow[], warehouses: WarehouseRow[], lots: LotRow[]) {
  const itemOptions = items.map((item) => ({ label: `${item.sku} - ${item.name}`, value: item.id }));
  const warehouseOptions = warehouses.map((warehouse) => ({ label: `${warehouse.code} - ${warehouse.name}`, value: warehouse.id }));
  const lotOptions = lots.map((lot) => ({ label: `${lot.item.sku} / ${lot.lotNumber}`, value: lot.id }));
  if (tab === 'profiles') {
    return [
      { name: 'itemId', label: 'Item', options: itemOptions, required: true },
      { name: 'productCategory', label: 'Categoria', required: true },
      { name: 'agriculturalGroup', label: 'Grupo agricola' },
      { name: 'variety', label: 'Variedade' },
      { name: 'originRegion', label: 'Origem/regiao' },
      { name: 'defaultShelfLifeDays', label: 'Shelf life dias' },
      { name: 'saleCfopDefault', label: 'CFOP venda' },
      { name: 'purchaseCfopDefault', label: 'CFOP compra' },
    ];
  }
  if (tab === 'quality') {
    return [
      { name: 'itemId', label: 'Item', options: itemOptions, required: true },
      { name: 'lotId', label: 'Lote', options: lotOptions },
      { name: 'status', label: 'Status', options: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PENDING'].map((v) => ({ label: v, value: v })) },
      { name: 'grade', label: 'Grade' },
      { name: 'freshnessClass', label: 'Frescor' },
      { name: 'acceptedQuantityKg', label: 'Kg aceito' },
      { name: 'rejectedQuantityKg', label: 'Kg rejeitado' },
      { name: 'notes', label: 'Notas' },
    ];
  }
  if (tab === 'losses') {
    return [
      { name: 'itemId', label: 'Item', options: itemOptions, required: true },
      { name: 'lotId', label: 'Lote', options: lotOptions },
      { name: 'reason', label: 'Motivo', required: true, options: ['SPOILAGE', 'SHRINKAGE', 'DAMAGE', 'QUALITY_RECLASSIFICATION', 'WEIGHT_VARIANCE', 'OTHER'].map((v) => ({ label: v, value: v })) },
      { name: 'quantityKg', label: 'Quantidade kg', required: true },
      { name: 'costImpact', label: 'Impacto custo' },
      { name: 'notes', label: 'Notas' },
    ];
  }
  if (tab === 'routes') {
    return [
      { name: 'code', label: 'Codigo', required: true },
      { name: 'name', label: 'Nome', required: true },
      { name: 'scheduledDate', label: 'Data programada' },
      { name: 'vehicleId', label: 'Veiculo' },
      { name: 'driverName', label: 'Motorista' },
      { name: 'freightCost', label: 'Custo frete' },
    ];
  }
  return [
    { name: 'itemId', label: 'Item', options: itemOptions, required: true },
    { name: 'lotNumber', label: 'Lote', required: true },
    { name: 'warehouseId', label: 'Armazem', options: warehouseOptions },
    { name: 'quantityKg', label: 'Quantidade kg', required: true },
    { name: 'costAmount', label: 'Custo total' },
    { name: 'shelfLifeDays', label: 'Shelf life dias' },
    { name: 'expirationDate', label: 'Validade ISO' },
    { name: 'qualityGrade', label: 'Grade' },
    { name: 'freshnessClass', label: 'Frescor' },
    { name: 'originRegion', label: 'Origem/regiao' },
  ];
}

function LotTable({ rows, empty }: { rows: LotRow[]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
          <tr>
            <th className="py-2 pr-3">Item</th>
            <th className="py-2 pr-3">Lote</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3 text-right">Kg</th>
            <th className="py-2 pr-3">Validade</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-2 pr-3">{row.item.sku}</td>
                <td className="py-2 pr-3 font-mono text-xs">{row.lotNumber}</td>
                <td className="py-2 pr-3">{row.status}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{String(row.quantityOnHandKg)}</td>
                <td className="py-2 pr-3">{row.expirationDate ? row.expirationDate.slice(0, 10) : '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="py-4 text-slate-500">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'amber' | 'red' }) {
  const toneClass =
    tone === 'red'
      ? 'text-red-700 dark:text-red-300'
      : tone === 'amber'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  required,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
