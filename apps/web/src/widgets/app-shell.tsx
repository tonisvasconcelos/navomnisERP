import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/features/auth/auth-store';
import { useShellStore } from './shell-store';
import { api } from '@/shared/api/client';

type MeResponse = { permissions: string[] };

function unwrapMe(envelope: unknown): MeResponse {
  return ((envelope as { data?: MeResponse }).data ?? envelope) as MeResponse;
}

export function AppShell() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const theme = useShellStore((s) => s.theme);
  const setTheme = useShellStore((s) => s.setTheme);

  const { data: me, isPending, isError } = useQuery({
    queryKey: ['auth-me'],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return unwrapMe(data);
    },
    staleTime: 60_000,
  });

  const can = (code: string) => Boolean(me?.permissions?.includes(code));

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', dark);
  }, [theme]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;

  const handleLogout = async () => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      try {
        await api.post('/auth/logout');
      } catch {
        // sessão local é limpa mesmo se a rede falhar
      }
    }
    queryClient.removeQueries({ queryKey: ['auth-me'] });
    clear();
  };

  const moduleNav = () => {
    if (isError) {
      return (
        <span className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Não foi possível carregar permissões.
        </span>
      );
    }
    if (isPending) {
      return <span className="px-3 py-2 text-xs text-slate-400">A carregar permissões…</span>;
    }
    return (
      <>
        {can('sales.read') ? (
          <NavLink to="/sales" className={navClass} data-testid="nav-sales">
            Vendas
          </NavLink>
        ) : null}
        {can('inventory.read') ? (
          <NavLink to="/inventory" className={navClass} data-testid="nav-inventory">
            Estoque
          </NavLink>
        ) : null}
        {can('inventory.read') ? (
          <NavLink to="/produce" className={navClass} data-testid="nav-produce">
            Hortifruti
          </NavLink>
        ) : null}
        {can('audit.read') ? (
          <NavLink to="/audit" className={navClass} data-testid="nav-audit">
            Auditoria
          </NavLink>
        ) : null}
        {can('fiscal.read') ? (
          <NavLink to="/fiscal" className={navClass} data-testid="nav-fiscal">
            Fiscal
          </NavLink>
        ) : null}
        {can('fiscal.read') ? (
          <NavLink to="/fiscal/setup" className={navClass} data-testid="nav-fiscal-setup">
            Setup fiscal
          </NavLink>
        ) : null}
        {can('banking.read') ? (
          <NavLink to="/banking" className={navClass} data-testid="nav-banking">
            Banking
          </NavLink>
        ) : null}
      </>
    );
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Saltar para o conteúdo
      </a>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Navomnis</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">ERP</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <NavLink to="/" end className={navClass}>
            Painel
          </NavLink>
          <span className="px-3 py-2 text-xs uppercase text-slate-400">Módulos</span>
          {moduleNav()}
          {!can('banking.read') ? (
            <span className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-slate-400">Financeiro</span>
          ) : null}
          <span className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-slate-400">Compras</span>
        </nav>
        <div className="border-t border-slate-200 p-2 dark:border-slate-800">
          <button
            type="button"
            data-testid="logout"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => void handleLogout()}
          >
            {t('auth.logout')}
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <motion.div initial={false} className="hidden text-sm text-slate-500 sm:block">
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600">
                Ctrl
              </kbd>{' '}
              +{' '}
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600">
                K
              </kbd>{' '}
              — paleta de comandos (em breve)
            </motion.div>
            <nav className="flex gap-1 md:hidden" aria-label="Navegação principal">
              <NavLink to="/" end className={navClass}>
                Painel
              </NavLink>
              {moduleNav()}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
            <button
              type="button"
              data-testid="logout-mobile"
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
              onClick={() => void handleLogout()}
            >
              {t('auth.logout')}
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
    </>
  );
}
