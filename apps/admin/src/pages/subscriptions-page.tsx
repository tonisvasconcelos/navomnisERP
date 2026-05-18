import { Link, Navigate } from 'react-router-dom';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { ActionLink, btnPrimary } from '@/components/ui-buttons';
import type { PlanSummary } from '@/features/platform/types';
import { usePlatformPlans } from '@/features/platform/use-platform-subscriptions';
import { usePlatformPermission } from '@/hooks/use-platform-permission';

export function SubscriptionsPage() {
  return <Navigate to="/subscriptions/plans" replace />;
}

export function PlansListPage() {
  const { data, isLoading } = usePlatformPlans();
  const canWrite = usePlatformPermission('platform.subscriptions.write');

  return (
    <div>
      <PageHeader
        title="Planos de subscrição"
        actions={
          canWrite ? (
            <Link to="/subscriptions/plans/new" className={btnPrimary}>
              Criar plano
            </Link>
          ) : null
        }
      />
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <DataTable<PlanSummary>
          columns={['Código', 'Nome', 'Tipo', 'Preço', 'Estado']}
          rows={data ?? []}
          rowKey={(p) => p.id}
          getCells={(p) => [
            p.code,
            p.name,
            p.planType,
            (p.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: p.currency }),
            p.archivedAt ? 'Arquivado' : p.isActive ? 'Ativo' : 'Inativo',
          ]}
          renderActions={(p) => <ActionLink to={`/subscriptions/plans/${p.id}`}>Ver</ActionLink>}
        />
      )}
    </div>
  );
}
