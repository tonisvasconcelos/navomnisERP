import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput } from '@/components/form-field';
import { btnDanger, btnPrimary, btnSecondary } from '@/components/ui-buttons';
import { usePlatformTenants } from '@/features/platform/use-platform-tenants';
import {
  useAssignTenant,
  usePlatformUser,
  useUserSecurity,
} from '@/features/platform/use-platform-users';
import { usePlatformPermission } from '@/hooks/use-platform-permission';
import { apiErrorMessage } from '@/lib/api-error';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = usePlatformUser(id);
  const { data: tenants } = usePlatformTenants();
  const assign = useAssignTenant(id ?? '');
  const security = useUserSecurity(id ?? '');
  const canWrite = usePlatformPermission('platform.users.write');
  const canSecurity = usePlatformPermission('platform.users.security');

  const [tenantId, setTenantId] = useState('');
  const [confirmSecurity, setConfirmSecurity] = useState<
    'block' | 'unblock' | 'reset' | 'revoke' | null
  >(null);

  const runSecurity = async () => {
    try {
      if (confirmSecurity === 'block') await security.block.mutateAsync();
      if (confirmSecurity === 'unblock') await security.unblock.mutateAsync();
      if (confirmSecurity === 'reset') await security.forceReset.mutateAsync();
      if (confirmSecurity === 'revoke') await security.revokeSessions.mutateAsync();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setConfirmSecurity(null);
    }
  };

  const onAssign = async () => {
    if (!tenantId) return;
    try {
      await assign.mutateAsync({ tenantId, isDefault: false });
      alert('Tenant atribuído.');
      setTenantId('');
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  if (isLoading || !user) {
    return <p className="text-slate-400">Carregando…</p>;
  }

  const pendingInvite = user.userInvites?.find((i) => !i.acceptedAt);

  return (
    <div>
      <PageHeader
        title={user.displayName}
        description={user.email}
        backTo="/users"
        actions={
          canWrite ? (
            <Link to={`/users/${id}/edit`} className={btnSecondary}>
              Editar
            </Link>
          ) : null
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="rounded border border-slate-800 p-4">
          <h3 className="mb-3 font-medium text-white">Perfil</h3>
          <dl className="space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-slate-500">Locale</dt>
              <dd>{user.locale ?? 'pt-BR'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>
                {user.blockedAt
                  ? 'Bloqueado'
                  : user.passwordHash
                    ? 'Ativo'
                    : 'Aguarda aceitação do convite'}
              </dd>
            </div>
            {pendingInvite ? (
              <div>
                <dt className="text-slate-500">Convite pendente</dt>
                <dd>Expira em {new Date(pendingInvite.expiresAt).toLocaleString('pt-BR')}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded border border-slate-800 p-4">
          <h3 className="mb-3 font-medium text-white">Tenants</h3>
          <ul className="mb-4 space-y-1 text-sm text-slate-300">
            {user.userTenants.map((ut) => (
              <li key={ut.tenant.id}>
                {ut.tenant.name} ({ut.tenant.slug})
                {ut.isDefault ? ' · padrão' : ''}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="space-y-2">
              <FormField label="Atribuir a tenant">
                <SelectInput value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                  <option value="">Selecionar…</option>
                  {(tenants?.items ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <button type="button" className={btnPrimary} onClick={() => void onAssign()}>
                Atribuir tenant
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {canSecurity ? (
        <section className="rounded border border-slate-800 p-4">
          <h3 className="mb-3 font-medium text-white">Segurança</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnDanger} onClick={() => setConfirmSecurity('block')}>
              Bloquear
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmSecurity('unblock')}>
              Desbloquear
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmSecurity('reset')}>
              Forçar reset de senha
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmSecurity('revoke')}>
              Revogar sessões
            </button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmSecurity !== null}
        title="Confirmar ação de segurança"
        message={`Executar «${confirmSecurity}» em ${user.email}?`}
        destructive={confirmSecurity === 'block'}
        onCancel={() => setConfirmSecurity(null)}
        onConfirm={() => void runSecurity()}
      />
    </div>
  );
}
