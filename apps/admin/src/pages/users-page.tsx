import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { TextInput } from '@/components/form-field';
import { ActionLink, btnPrimary } from '@/components/ui-buttons';
import type { UserSummary } from '@/features/platform/types';
import { usePlatformTenants } from '@/features/platform/use-platform-tenants';
import { usePlatformUsers } from '@/features/platform/use-platform-users';
import { usePlatformPermission } from '@/hooks/use-platform-permission';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [q, setQ] = useState('');
  const [tq, setTq] = useState('');
  const { data, isLoading } = usePlatformUsers(q, tq || undefined);
  const { data: tenants } = usePlatformTenants();
  const canWrite = usePlatformPermission('platform.users.write');

  return (
    <div>
      <PageHeader
        title="Utilizadores"
        actions={
          canWrite ? (
            <Link to="/users/invite" className={btnPrimary}>
              Convidar utilizador
            </Link>
          ) : null
        }
      />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setTq(tenantId);
        }}
      >
        <TextInput
          placeholder="Pesquisar e-mail ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="">Todos os tenants</option>
          {(tenants?.items ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
          Filtrar
        </button>
      </form>
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <DataTable<UserSummary>
          columns={['E-mail', 'Nome', 'Tenants', 'Estado']}
          rows={data?.items ?? []}
          rowKey={(u) => u.id}
          getCells={(u) => [
            u.email,
            u.displayName,
            u.userTenants.map((ut) => ut.tenant.slug).join(', ') || '—',
            u.blockedAt ? 'Bloqueado' : u.passwordHash ? 'Ativo' : 'Convite pendente',
          ]}
          renderActions={(u) => (
            <>
              <ActionLink to={`/users/${u.id}`}>Ver</ActionLink>
              {canWrite ? (
                <>
                  {' · '}
                  <ActionLink to={`/users/${u.id}/edit`}>Editar</ActionLink>
                </>
              ) : null}
            </>
          )}
        />
      )}
    </div>
  );
}
