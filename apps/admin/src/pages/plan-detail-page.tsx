import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { btnDanger, btnSecondary } from '@/components/ui-buttons';
import { usePlatformPlan, usePlanActions } from '@/features/platform/use-platform-subscriptions';
import { usePlatformPermission } from '@/hooks/use-platform-permission';
import { apiErrorMessage } from '@/lib/api-error';

type Action = 'deactivate' | 'archive' | null;

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading } = usePlatformPlan(id);
  const actions = usePlanActions(id ?? '');
  const canWrite = usePlatformPermission('platform.subscriptions.write');
  const [pending, setPending] = useState<Action>(null);

  const run = async () => {
    try {
      if (pending === 'deactivate') await actions.deactivate.mutateAsync();
      if (pending === 'archive') await actions.archive.mutateAsync();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  if (isLoading || !plan) {
    return <p className="text-slate-400">Carregando…</p>;
  }

  return (
    <div>
      <PageHeader title={plan.name} description={plan.code} backTo="/subscriptions/plans" />
      <dl className="mb-8 max-w-lg space-y-2 rounded border border-slate-800 p-4 text-sm text-slate-300">
        <div>
          <dt className="text-slate-500">Tipo</dt>
          <dd>{plan.planType}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Preço</dt>
          <dd>
            {(plan.priceCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: plan.currency,
            })}{' '}
            / {plan.billingCycle}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Trial</dt>
          <dd>{plan.trialDays} dias</dd>
        </div>
        <div>
          <dt className="text-slate-500">Estado</dt>
          <dd>{plan.archivedAt ? 'Arquivado' : plan.isActive ? 'Ativo' : 'Inativo'}</dd>
        </div>
        {plan.description ? (
          <div>
            <dt className="text-slate-500">Descrição</dt>
            <dd>{plan.description}</dd>
          </div>
        ) : null}
      </dl>
      {canWrite ? (
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={() => setPending('deactivate')}>
            Desativar
          </button>
          <button type="button" className={btnDanger} onClick={() => setPending('archive')}>
            Arquivar
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        title="Confirmar"
        message={`Tem a certeza que deseja ${pending} este plano?`}
        destructive={pending === 'archive'}
        onCancel={() => setPending(null)}
        onConfirm={() => void run()}
      />
    </div>
  );
}
