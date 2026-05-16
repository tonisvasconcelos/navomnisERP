import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import { bankingApi, unwrap, type Institution } from './banking-api';

type CompanyRow = { id: string; name: string };

export function BankingConnectPage() {
  const [params] = useSearchParams();
  const [companyId, setCompanyId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const consentStatus = params.get('status');

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: async () => unwrap<CompanyRow[]>((await api.get('/parties/companies')).data),
  });

  const institutionsQ = useQuery({
    queryKey: ['banking-institutions'],
    queryFn: bankingApi.institutions,
    retry: false,
  });

  useEffect(() => {
    if (companiesQ.data?.length && !companyId) {
      setCompanyId(companiesQ.data[0].id);
    }
  }, [companiesQ.data, companyId]);

  const connect = useMutation({
    mutationFn: () => bankingApi.startConnection(companyId, institutionId),
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Conectar banco</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          OAuth no servidor — tokens nunca ficam no navegador.
        </p>
      </header>

      {consentStatus === 'authorised' ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Consentimento autorizado. Sincronização de contas enfileirada.
        </p>
      ) : null}

      {institutionsQ.isError ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {getApiErrorMessage(
            institutionsQ.error,
            'Open Finance desabilitado ou indisponível. Defina OPEN_FINANCE_ENABLED=true na API.',
          )}
        </p>
      ) : null}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Empresa</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {(companiesQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Instituição (sandbox)</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {(institutionsQ.data ?? []).map((i: Institution) => (
              <option key={i.id} value={i.id}>
                {i.brandName}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={!companyId || !institutionId || connect.isPending}
          onClick={() => connect.mutate()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {connect.isPending ? 'A iniciar…' : 'Iniciar consentimento'}
        </button>
        {connect.isError ? (
          <p className="text-sm text-red-600">{getApiErrorMessage(connect.error)}</p>
        ) : null}
      </div>
    </div>
  );
}
