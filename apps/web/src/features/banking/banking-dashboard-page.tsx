import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { getApiErrorMessage } from '@/shared/api/errors';
import { bankingApi, unwrap } from './banking-api';

type CompanyRow = { id: string; name: string };

export function BankingDashboardPage() {
  const [companyId, setCompanyId] = useState('');
  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: async () => unwrap<CompanyRow[]>((await api.get('/parties/companies')).data),
  });

  useEffect(() => {
    if (companiesQ.data?.length && !companyId) setCompanyId(companiesQ.data[0].id);
  }, [companiesQ.data, companyId]);

  const summaryQ = useQuery({
    queryKey: ['banking-summary', companyId],
    enabled: Boolean(companyId),
    queryFn: () => bankingApi.dashboard(companyId),
    retry: false,
  });

  const s = summaryQ.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Banking</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Saldos consolidados e movimentação recente.</p>
        </div>
        <Link
          to="/banking/connect"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Conectar banco
        </Link>
      </div>

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

      {summaryQ.isError ? (
        <p className="text-sm text-amber-700">{getApiErrorMessage(summaryQ.error)}</p>
      ) : null}

      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Saldo consolidado" value={`R$ ${s.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
          <StatCard label="Contas" value={String(s.accountCount)} />
          <StatCard label="Conexões" value={String(s.connectionCount)} />
          <StatCard label="Pend. conciliação" value={String(s.pendingReconciliationCount)} />
        </div>
      ) : null}

      {s?.recentTransactions?.length ? (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
            Movimentos recentes
          </h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {s.recentTransactions.map((tx) => (
              <li key={tx.id} className="flex justify-between px-4 py-3 text-sm">
                <span>{tx.description ?? tx.transactionType}</span>
                <span className={Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link to="/banking/reconciliation" className="text-blue-600 hover:underline">
          Conciliação
        </Link>
        <Link to="/banking/pix" className="text-blue-600 hover:underline">
          Monitor Pix
        </Link>
      </nav>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
