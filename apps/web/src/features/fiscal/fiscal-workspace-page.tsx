import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';

type FiscalSummary = {
  jurisdictions: number;
  regimes: number;
  operationTypes: number;
  taxGroups: number;
  activeRules: number;
  productProfiles: number;
  partyProfiles: number;
  fiscalDocuments: number;
  postedTaxEntries: number;
  reformTaxesConfigured: { taxKind: string; rules: number }[];
  readinessWarnings: string[];
};

type CompanyRow = { id: string; name: string };
type CustomerRow = { id: string; name: string };
type ItemRow = { id: string; sku: string; name: string };
type RuleRow = {
  id: string;
  taxKind: string;
  priority: number;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  formulaCode: string | null;
  legalReference: string | null;
};

type TaxPreview = {
  complianceNotice: string;
  totals: { documentAmount: string; taxAmount: string; totalWithTaxes: string };
  lines: {
    lineNumber: number;
    description: string;
    lineAmount: string;
    taxes: { taxKind: string; baseAmount: string; rate: string; amount: string; legalReference: string | null }[];
    warnings: string[];
  }[];
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function FiscalWorkspacePage() {
  const [companyId, setCompanyId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitAmount, setUnitAmount] = useState('100');

  const summaryQ = useQuery({
    queryKey: ['fiscal-summary'],
    queryFn: async () => unwrap<FiscalSummary>((await api.get('/fiscal/setup/summary')).data),
  });
  const rulesQ = useQuery({
    queryKey: ['fiscal-rules'],
    queryFn: async () => unwrap<RuleRow[]>((await api.get('/fiscal/tax-rules')).data),
  });
  const companiesQ = useQuery({
    queryKey: ['parties-companies'],
    queryFn: async () => unwrap<CompanyRow[]>((await api.get('/parties/companies')).data),
  });
  const customersQ = useQuery({
    queryKey: ['parties-customers'],
    queryFn: async () => unwrap<CustomerRow[]>((await api.get('/parties/customers')).data),
  });
  const itemsQ = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => unwrap<ItemRow[]>((await api.get('/inventory/items')).data),
  });

  useEffect(() => {
    if (!companyId && companiesQ.data?.[0]) setCompanyId(companiesQ.data[0].id);
  }, [companiesQ.data, companyId]);
  useEffect(() => {
    if (!partyId && customersQ.data?.[0]) setPartyId(customersQ.data[0].id);
  }, [customersQ.data, partyId]);
  useEffect(() => {
    if (!itemId && itemsQ.data?.[0]) setItemId(itemsQ.data[0].id);
  }, [itemsQ.data, itemId]);

  const preview = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/fiscal/tax-preview', {
        companyId,
        partyId,
        operationTypeCode: 'VENDA_MERCADORIA_INTERNA',
        lines: [
          {
            itemId,
            description: 'Linha de prévia fiscal',
            quantity,
            unitAmount,
          },
        ],
      });
      return unwrap<TaxPreview>(data);
    },
  });

  const reformSet = useMemo(
    () => new Set((summaryQ.data?.reformTaxesConfigured ?? []).map((row) => row.taxKind)),
    [summaryQ.data?.reformTaxesConfigured],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Fiscal Brasil</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Parametrização fiscal, reforma tributária e prévias de cálculo.
        </p>
        <a
          href="/fiscal/setup"
          className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Abrir setup fiscal
        </a>
      </div>

      {summaryQ.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {getApiErrorMessage(summaryQ.error, 'Não foi possível carregar o resumo fiscal.')}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4" aria-label="Resumo fiscal">
        {[
          ['Jurisdições', summaryQ.data?.jurisdictions],
          ['Regras ativas', summaryQ.data?.activeRules],
          ['Perfis produto', summaryQ.data?.productProfiles],
          ['Perfis cliente/fornecedor', summaryQ.data?.partyProfiles],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summaryQ.isLoading ? '…' : value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Reforma tributária</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {['IBS', 'CBS', 'IS'].map((tax) => (
            <span
              key={tax}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                reformSet.has(tax)
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
              }`}
            >
              {tax}: {reformSet.has(tax) ? 'parametrizado' : 'pendente'}
            </span>
          ))}
        </div>
        {summaryQ.data?.readinessWarnings?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-200">
            {summaryQ.data.readinessWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          onSubmit={(event) => {
            event.preventDefault();
            preview.mutate();
          }}
        >
          <h3 className="text-sm font-semibold">Prévia fiscal</h3>
          <Select label="Empresa" value={companyId} onChange={setCompanyId} rows={companiesQ.data ?? []} />
          <Select label="Cliente" value={partyId} onChange={setPartyId} rows={customersQ.data ?? []} />
          <Select
            label="Item"
            value={itemId}
            onChange={setItemId}
            rows={(itemsQ.data ?? []).map((item) => ({ id: item.id, name: `${item.sku} - ${item.name}` }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade" value={quantity} onChange={setQuantity} />
            <Field label="Valor unitário" value={unitAmount} onChange={setUnitAmount} />
          </div>
          <button
            type="submit"
            disabled={preview.isPending || !companyId || !partyId || !itemId}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {preview.isPending ? 'Calculando…' : 'Calcular prévia'}
          </button>
          {preview.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {getApiErrorMessage(preview.error, 'Falha na prévia fiscal.')}
            </p>
          ) : null}
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold">Resultado</h3>
          {preview.data ? (
            <div className="mt-3 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Metric label="Base" value={preview.data.totals.documentAmount} />
                <Metric label="Tributos" value={preview.data.totals.taxAmount} />
                <Metric label="Total" value={preview.data.totals.totalWithTaxes} />
              </div>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                {preview.data.complianceNotice}
              </p>
              {preview.data.lines.map((line) => (
                <div key={line.lineNumber} className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2">Tributo</th>
                        <th className="py-2 text-right">Base</th>
                        <th className="py-2 text-right">Alíquota</th>
                        <th className="py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.taxes.map((tax) => (
                        <tr key={`${line.lineNumber}-${tax.taxKind}`} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-2 font-medium">{tax.taxKind}</td>
                          <td className="py-2 text-right tabular-nums">{tax.baseAmount}</td>
                          <td className="py-2 text-right tabular-nums">{tax.rate}%</td>
                          <td className="py-2 text-right tabular-nums">{tax.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Execute uma prévia para visualizar a decomposição fiscal.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold">Regras tributárias</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="py-2">Tributo</th>
                <th className="py-2">Fórmula</th>
                <th className="py-2 text-right">Prioridade</th>
                <th className="py-2 text-right">Alíquota</th>
                <th className="py-2">Referência</th>
              </tr>
            </thead>
            <tbody>
              {(rulesQ.data ?? []).map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="py-2 font-medium">{rule.taxKind}</td>
                  <td className="py-2">{rule.formulaCode ?? '—'}</td>
                  <td className="py-2 text-right tabular-nums">{rule.priority}</td>
                  <td className="py-2 text-right tabular-nums">{rule.rate}%</td>
                  <td className="py-2 text-xs text-slate-500">{rule.legalReference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: { id: string; name: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
      >
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
