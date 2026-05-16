import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import { bankingApi, unwrap } from './banking-api';

type CompanyRow = { id: string; name: string };

export function BankingReconciliationPage() {
  const [companyId, setCompanyId] = useState('');
  const queryClient = useQueryClient();

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: async () => unwrap<CompanyRow[]>((await api.get('/parties/companies')).data),
  });

  useEffect(() => {
    if (companiesQ.data?.length && !companyId) setCompanyId(companiesQ.data[0].id);
  }, [companiesQ.data, companyId]);

  const suggestionsQ = useQuery({
    queryKey: ['banking-recon', companyId],
    enabled: Boolean(companyId),
    queryFn: () => bankingApi.reconciliationSuggestions(companyId),
    retry: false,
  });

  const persist = useMutation({
    mutationFn: () => api.post('/banking/reconciliation/suggest-persist', { companyId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banking-recon', companyId] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Conciliação</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sugestões banco ↔ AR/AP (sandbox).
        </p>
      </header>

      <select
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
      >
        {(companiesQ.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => persist.mutate()}
        disabled={!companyId || persist.isPending}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Gerar e persistir sugestões
      </button>

      {suggestionsQ.isError ? (
        <p className="text-sm text-amber-700">{getApiErrorMessage(suggestionsQ.error)}</p>
      ) : null}

      <ul className="space-y-3">
        {(suggestionsQ.data ?? []).map((row) => (
          <li
            key={row.bankTransactionId}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs text-slate-500">Transação {row.bankTransactionId}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {row.matches.map((m) => (
                <li key={`${m.targetId}-${m.matcher}`}>
                  {m.matcher} → {m.targetId} ({Math.round(m.confidence * 100)}%)
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
