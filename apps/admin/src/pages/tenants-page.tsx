import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { TextInput } from '@/components/form-field';
import { ActionLink, btnPrimary } from '@/components/ui-buttons';
import type { TenantSummary } from '@/features/platform/types';
import { usePlatformTenants } from '@/features/platform/use-platform-tenants';
import { usePlatformPermission } from '@/hooks/use-platform-permission';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading } = usePlatformTenants(q);
  const canWrite = usePlatformPermission('platform.tenants.write');

  return (
    <div>
      <PageHeader
        title="Tenants"
        actions={
          canWrite ? (
            <Link to="/tenants/new" className={btnPrimary}>
              Criar tenant
            </Link>
          ) : null
        }
      />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
        }}
      >
        <TextInput
          placeholder="Pesquisar slug ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <button type="submit" className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
          Pesquisar
        </button>
      </form>
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <DataTable<TenantSummary>
          columns={['Slug', 'Nome', 'Status', 'Plano']}
          rows={data?.items ?? []}
          rowKey={(t) => t.id}
          getCells={(t) => [t.slug, t.name, t.status, t.subscription?.plan?.name ?? '—']}
          renderActions={(t) => (
            <>
              <ActionLink to={`/tenants/${t.id}`}>Ver</ActionLink>
              {canWrite ? (
                <>
                  {' · '}
                  <ActionLink to={`/tenants/${t.id}/edit`}>Editar</ActionLink>
                </>
              ) : null}
            </>
          )}
        />
      )}
    </div>
  );
}
