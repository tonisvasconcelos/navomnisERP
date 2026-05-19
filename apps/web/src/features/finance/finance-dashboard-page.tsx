import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';

type FinanceSummary = {
  message?: string;
  receivablesOpen?: number;
  payablesOpen?: number;
  chartOfAccountsCount?: number;
  glPostingEnabled?: boolean;
  limitsNote?: string;
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function FinanceDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: async () => {
      const { data: envelope } = await api.get('/finance/summary');
      return unwrap<FinanceSummary>(envelope);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Financeiro</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resumo operacional — não substitui contabilidade completa (GL).
        </p>
      </div>

      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        role="note"
      >
        {data?.limitsNote ??
          'Sem lançamentos de razão geral nesta versão. Valores abaixo são indicativos ou zero.'}
      </p>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Não foi possível carregar o resumo financeiro.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Contas a receber (aberto)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {isLoading ? '…' : String(data?.receivablesOpen ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Contas a pagar (aberto)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {isLoading ? '…' : String(data?.payablesOpen ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Contas no plano</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {isLoading ? '…' : String(data?.chartOfAccountsCount ?? 0)}
          </p>
        </div>
      </div>

      {data?.message && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{data.message}</p>
      )}

      <Link
        to="/finance/accounts"
        className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Ver plano de contas
      </Link>
    </div>
  );
}
