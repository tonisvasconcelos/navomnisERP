import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';

type Summary = {
  itemTemplates: number;
  serviceTemplates: number;
  companyProfiles: number;
  branches: number;
  employees: number;
  partyProfiles: number;
  readinessWarnings: string[];
};
type MasterRow = { id: string; code?: string; name?: string; legalName?: string; fullName?: string; cnpj?: string };
type CompanyRow = { id: string; name: string; taxId?: string | null };
type PartyRow = { id: string; name: string; taxId?: string | null };

const sections = [
  { id: 'items', label: 'Itens', endpoint: '/fiscal/item-templates' },
  { id: 'services', label: 'Servicos', endpoint: '/fiscal/service-templates' },
  { id: 'companies', label: 'Empresas', endpoint: '/fiscal/company-profiles' },
  { id: 'branches', label: 'Filiais', endpoint: '/fiscal/branches' },
  { id: 'employees', label: 'Colaboradores', endpoint: '/fiscal/employees' },
  { id: 'parties', label: 'Clientes/fornecedores', endpoint: '/fiscal/party-profiles' },
] as const;

type SectionId = (typeof sections)[number]['id'];

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function FiscalSetupPage() {
  const [section, setSection] = useState<SectionId>('items');
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const active = sections.find((item) => item.id === section) ?? sections[0];

  const summaryQ = useQuery({
    queryKey: ['fiscal-master-summary'],
    queryFn: async () => unwrap<Summary>((await api.get('/fiscal/master-data/summary')).data),
  });
  const rowsQ = useQuery({
    queryKey: ['fiscal-master-rows', section],
    queryFn: async () => unwrap<MasterRow[]>((await api.get(active.endpoint)).data),
  });
  const companiesQ = useQuery({
    queryKey: ['fiscal-setup-companies'],
    queryFn: async () => unwrap<CompanyRow[]>((await api.get('/parties/companies')).data),
  });
  const partiesQ = useQuery({
    queryKey: ['fiscal-setup-parties'],
    queryFn: async () => unwrap<PartyRow[]>((await api.get('/parties/customers')).data),
  });

  const fields = useMemo(() => buildFields(section, companiesQ.data ?? [], partiesQ.data ?? []), [section, companiesQ.data, partiesQ.data]);

  const create = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(section, form);
      const { data } = await api.post(active.endpoint, payload);
      return unwrap<MasterRow>(data);
    },
    onSuccess: async () => {
      setForm({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fiscal-master-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['fiscal-master-rows', section] }),
      ]);
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Setup fiscal Brasil</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cadastros mestres para produtos, servicos, empresas, filiais, clientes, fornecedores e base trabalhista.
          </p>
        </div>
        <a
          href="/fiscal"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Previa fiscal
        </a>
      </div>

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Resumo dos cadastros fiscais">
        <Metric label="Itens" value={summaryQ.data?.itemTemplates ?? 0} />
        <Metric label="Servicos" value={summaryQ.data?.serviceTemplates ?? 0} />
        <Metric label="Empresas" value={summaryQ.data?.companyProfiles ?? 0} />
        <Metric label="Filiais" value={summaryQ.data?.branches ?? 0} />
        <Metric label="Colaboradores" value={summaryQ.data?.employees ?? 0} />
        <Metric label="Partes" value={summaryQ.data?.partyProfiles ?? 0} />
      </section>

      {summaryQ.data?.readinessWarnings?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {summaryQ.data.readinessWarnings.join(' ')}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Familias de setup fiscal">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id);
              setForm({});
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              section === item.id
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(20rem,28rem)_1fr]">
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleSubmit}
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{active.label}</h3>
          {fields.map((field) =>
            field.options ? (
              <SelectField
                key={field.name}
                label={field.label}
                value={form[field.name] ?? ''}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
                options={field.options}
                required={field.required}
              />
            ) : (
              <TextField
                key={field.name}
                label={field.label}
                value={form[field.name] ?? ''}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
                required={field.required}
              />
            ),
          )}
          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {create.isPending ? 'Salvando...' : 'Salvar setup'}
          </button>
          {create.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {getApiErrorMessage(create.error, 'Nao foi possivel salvar o setup fiscal.')}
            </p>
          ) : null}
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Registros configurados</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2">Codigo</th>
                  <th className="py-2">Nome</th>
                  <th className="py-2">Documento</th>
                </tr>
              </thead>
              <tbody>
                {(rowsQ.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="py-2 font-medium">{row.code ?? '-'}</td>
                    <td className="py-2">{row.name ?? row.legalName ?? row.fullName ?? '-'}</td>
                    <td className="py-2 text-xs text-slate-500">{row.cnpj ?? '-'}</td>
                  </tr>
                ))}
                {!rowsQ.isLoading && !rowsQ.data?.length ? (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan={3}>
                      Nenhum registro fiscal nesta familia.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildFields(section: SectionId, companies: CompanyRow[], parties: PartyRow[]) {
  const companyOptions = companies.map((company) => ({ label: company.name, value: company.id }));
  const partyOptions = parties.map((party) => ({ label: party.name, value: party.id }));
  const required = true;
  if (section === 'items') {
    return [
      { name: 'code', label: 'Codigo', required },
      { name: 'name', label: 'Nome', required },
      { name: 'ncm', label: 'NCM' },
      { name: 'cest', label: 'CEST' },
      { name: 'icmsCst', label: 'CST ICMS' },
      { name: 'pisCst', label: 'CST PIS' },
      { name: 'cofinsCst', label: 'CST COFINS' },
      { name: 'ibsCategory', label: 'Categoria IBS' },
      { name: 'cbsCategory', label: 'Categoria CBS' },
    ];
  }
  if (section === 'services') {
    return [
      { name: 'code', label: 'Codigo', required },
      { name: 'name', label: 'Nome', required },
      { name: 'cnae', label: 'CNAE' },
      { name: 'lc116ServiceCode', label: 'Codigo LC 116' },
      { name: 'issRate', label: 'Aliquota ISS' },
      { name: 'issMunicipalityCode', label: 'Municipio ISS IBGE' },
      { name: 'ibsServiceClassification', label: 'Classificacao IBS' },
      { name: 'cbsServiceClassification', label: 'Classificacao CBS' },
    ];
  }
  if (section === 'companies') {
    return [
      { name: 'companyId', label: 'Empresa', options: companyOptions, required },
      { name: 'legalName', label: 'Razao social', required },
      { name: 'tradeName', label: 'Nome fantasia' },
      { name: 'cnpj', label: 'CNPJ', required },
      { name: 'mainCnae', label: 'CNAE principal' },
      {
        name: 'fiscalRegime',
        label: 'Regime fiscal',
        required,
        options: [
          { label: 'Simples Nacional', value: 'SIMPLES_NACIONAL' },
          { label: 'Lucro Presumido', value: 'LUCRO_PRESUMIDO' },
          { label: 'Lucro Real', value: 'LUCRO_REAL' },
          { label: 'MEI', value: 'MEI' },
        ],
      },
    ];
  }
  if (section === 'branches') {
    return [
      { name: 'companyId', label: 'Empresa', options: companyOptions, required },
      { name: 'code', label: 'Codigo', required },
      { name: 'name', label: 'Nome', required },
      { name: 'cnpj', label: 'CNPJ', required },
      { name: 'taxState', label: 'UF fiscal' },
      { name: 'taxMunicipalityCode', label: 'Municipio IBGE' },
    ];
  }
  if (section === 'employees') {
    return [
      { name: 'companyId', label: 'Empresa', options: companyOptions, required },
      { name: 'code', label: 'Matricula', required },
      { name: 'fullName', label: 'Nome completo', required },
      { name: 'cpf', label: 'CPF', required },
      { name: 'pisPasep', label: 'PIS/PASEP' },
      { name: 'esocialCategory', label: 'Categoria eSocial' },
      { name: 'department', label: 'Departamento' },
      { name: 'costCenter', label: 'Centro de custo' },
    ];
  }
  return [
    { name: 'partyId', label: 'Cliente/fornecedor', options: partyOptions, required },
    { name: 'cnpj', label: 'CPF/CNPJ' },
    { name: 'stateRegistration', label: 'IE' },
    { name: 'municipalRegistration', label: 'IM' },
    {
      name: 'taxpayerType',
      label: 'Tipo contribuinte',
      options: [
        { label: 'Contribuinte', value: 'CONTRIBUTOR' },
        { label: 'Nao contribuinte', value: 'NON_CONTRIBUTOR' },
        { label: 'Isento', value: 'EXEMPT' },
        { label: 'Consumidor', value: 'CONSUMER' },
      ],
    },
  ];
}

function buildPayload(section: SectionId, form: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
  if (section === 'companies') {
    return { fiscalRegime: 'SIMPLES_NACIONAL', ...clean };
  }
  if (section === 'parties') {
    return { taxpayerType: 'CONTRIBUTOR', ...clean };
  }
  return clean;
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
