import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import { bankingApi, unwrap } from './banking-api';

type CompanyRow = { id: string; name: string };
type PixRow = {
  id: string;
  amount: string | number;
  bookedAt: string;
  description: string | null;
  pixDetail?: { endToEndId: string | null } | null;
};

export function BankingPixPage() {
  const [companyId, setCompanyId] = useState('');
  const [endToEndId, setEndToEndId] = useState('');

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: async () => unwrap<CompanyRow[]>((await api.get('/parties/companies')).data),
  });

  useEffect(() => {
    if (companiesQ.data?.length && !companyId) setCompanyId(companiesQ.data[0].id);
  }, [companiesQ.data, companyId]);

  const pixQ = useQuery({
    queryKey: ['banking-pix', companyId, endToEndId],
    enabled: Boolean(companyId),
    queryFn: () => bankingApi.pix(companyId, endToEndId || undefined),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Pix</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Filtro por E2E ID (somente leitura).</p>
      </header>

      <div className="flex flex-wrap gap-3">
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
        <input
          type="search"
          placeholder="E2E ID"
          value={endToEndId}
          onChange={(e) => setEndToEndId(e.target.value)}
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        />
      </div>

      {pixQ.isError ? <p className="text-sm text-amber-700">{getApiErrorMessage(pixQ.error)}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">E2E</th>
              <th className="px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {((pixQ.data ?? []) as PixRow[]).map((row) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2">{new Date(row.bookedAt).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.pixDetail?.endToEndId ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  {Number(row.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
