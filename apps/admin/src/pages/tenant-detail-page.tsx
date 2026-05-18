import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput } from '@/components/form-field';
import { btnDanger, btnPrimary, btnSecondary } from '@/components/ui-buttons';
import {
  useAssignSubscription,
  usePlatformPlans,
  useSubscriptionLifecycle,
} from '@/features/platform/use-platform-subscriptions';
import { usePlatformTenant, useTenantLifecycle } from '@/features/platform/use-platform-tenants';
import { usePlatformPermission } from '@/hooks/use-platform-permission';
import { apiErrorMessage } from '@/lib/api-error';

type LifecycleAction = 'activate' | 'suspend' | 'block' | 'restore' | 'delete' | null;

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading } = usePlatformTenant(id);
  const lifecycle = useTenantLifecycle(id ?? '');
  const { data: plans } = usePlatformPlans();
  const assign = useAssignSubscription(id ?? '');
  const subLifecycle = useSubscriptionLifecycle(id ?? '');
  const canWrite = usePlatformPermission('platform.tenants.write');
  const canLifecycle = usePlatformPermission('platform.tenants.lifecycle');
  const canSubs = usePlatformPermission('platform.subscriptions.write');

  const [pending, setPending] = useState<LifecycleAction>(null);
  const [planId, setPlanId] = useState('');

  const runLifecycle = async () => {
    if (!pending || !id) return;
    try {
      if (pending === 'activate') await lifecycle.activate.mutateAsync();
      if (pending === 'suspend') await lifecycle.suspend.mutateAsync();
      if (pending === 'block') await lifecycle.block.mutateAsync();
      if (pending === 'restore') await lifecycle.restore.mutateAsync();
      if (pending === 'delete') {
        await lifecycle.softDelete.mutateAsync();
        navigate('/tenants');
      }
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const onAssignPlan = async () => {
    if (!planId) return;
    try {
      await assign.mutateAsync({ planId });
      alert('Plano atribuído.');
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  if (isLoading || !tenant) {
    return <p className="text-slate-400">Carregando…</p>;
  }

  return (
    <div>
      <PageHeader
        title={tenant.name}
        description={`${tenant.slug} · ${tenant.status}`}
        backTo="/tenants"
        actions={
          canWrite ? (
            <Link to={`/tenants/${id}/edit`} className={btnSecondary}>
              Editar
            </Link>
          ) : null
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="rounded border border-slate-800 p-4">
          <h3 className="mb-3 font-medium text-white">Dados</h3>
          <dl className="space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-slate-500">Razão social</dt>
              <dd>{tenant.legalName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">País / Tax ID</dt>
              <dd>
                {tenant.countryCode ?? '—'} / {tenant.taxId ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Fuso / idioma</dt>
              <dd>
                {tenant.timezone} / {tenant.defaultLanguage}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded border border-slate-800 p-4">
          <h3 className="mb-3 font-medium text-white">Subscrição</h3>
          {tenant.subscription ? (
            <p className="text-sm text-slate-300">
              {tenant.subscription.plan.name} ({tenant.subscription.status})
            </p>
          ) : (
            <p className="text-sm text-slate-500">Sem plano atribuído</p>
          )}
          {canSubs ? (
            <div className="mt-4 space-y-2">
              <FormField label="Atribuir plano">
                <SelectInput value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">Selecionar plano…</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <button type="button" className={btnPrimary} onClick={() => void onAssignPlan()}>
                Atribuir plano
              </button>
              {tenant.subscription ? (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void subLifecycle.suspend.mutateAsync()}
                  >
                    Suspender subscrição
                  </button>
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => void subLifecycle.cancel.mutateAsync()}
                  >
                    Cancelar subscrição
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {canLifecycle ? (
        <section className="rounded border border-slate-800 p-4">
          <h3 className="mb-3 font-medium text-white">Ciclo de vida</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => setPending('activate')}>
              Ativar
            </button>
            <button type="button" className={btnSecondary} onClick={() => setPending('suspend')}>
              Suspender
            </button>
            <button type="button" className={btnDanger} onClick={() => setPending('block')}>
              Bloquear
            </button>
            <button type="button" className={btnSecondary} onClick={() => setPending('restore')}>
              Restaurar
            </button>
            <button type="button" className={btnDanger} onClick={() => setPending('delete')}>
              Eliminar (soft)
            </button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title="Confirmar ação"
        message={`Tem a certeza que deseja executar «${pending}» neste tenant?`}
        destructive={pending === 'block' || pending === 'delete'}
        loading={
          lifecycle.activate.isPending ||
          lifecycle.suspend.isPending ||
          lifecycle.block.isPending ||
          lifecycle.restore.isPending ||
          lifecycle.softDelete.isPending
        }
        onCancel={() => setPending(null)}
        onConfirm={() => void runLifecycle()}
      />
    </div>
  );
}
