import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';

type MePayload = {
  email?: string;
  sub?: string;
  tenantId?: string;
  permissions?: string[];
};

function unwrapMe(envelope: unknown): MePayload {
  return ((envelope as { data?: MePayload }).data ?? envelope) as MePayload;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const { data: res } = await api.get('/auth/me');
      return unwrapMe(res);
    },
  });

  const can = (code: string) => Boolean(data?.permissions?.includes(code));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Painel</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Visão geral do tenant e atalhos operacionais.
        </p>
      </div>
      <section aria-labelledby="dash-shortcuts-heading" className="grid gap-4 md:grid-cols-3">
        <h3 id="dash-shortcuts-heading" className="sr-only">
          Atalhos de módulos
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Financeiro</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">—</p>
          <p className="mt-1 text-xs text-slate-500">KPIs em desenvolvimento</p>
        </div>
        {can('sales.read') ? (
          <Link
            to="/sales"
            aria-label="Ir para vendas — pedidos de venda"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
          >
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Vendas</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">→</p>
            <p className="mt-1 text-xs text-slate-500">Pedidos de venda</p>
          </Link>
        ) : (
          <div
            className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50"
            role="note"
            aria-label="Vendas — sem permissão de leitura"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Vendas</p>
            <p className="mt-2 text-xs text-slate-500">Sem permissão <span className="font-mono">sales.read</span>.</p>
          </div>
        )}
        {can('inventory.read') ? (
          <Link
            to="/inventory"
            aria-label="Ir para estoque — lançamentos"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
          >
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Estoque</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">→</p>
            <p className="mt-1 text-xs text-slate-500">Lançamentos</p>
          </Link>
        ) : (
          <div
            className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50"
            role="note"
            aria-label="Estoque — sem permissão de leitura"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Estoque</p>
            <p className="mt-2 text-xs text-slate-500">Sem permissão <span className="font-mono">inventory.read</span>.</p>
          </div>
        )}
      </section>
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Sessão</p>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>
        ) : data ? (
          <dl className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
            <div>
              <dt className="text-xs uppercase text-slate-500">E-mail</dt>
              <dd>{String(data.email ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Utilizador (sub)</dt>
              <dd className="font-mono text-xs">{String(data.sub ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Tenant</dt>
              <dd className="font-mono text-xs">{String(data.tenantId ?? '—')}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Sem dados de sessão.</p>
        )}
      </div>
    </div>
  );
}
