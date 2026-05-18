import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput, TextInput } from '@/components/form-field';
import { btnPrimary, btnSecondary } from '@/components/ui-buttons';
import { usePlatformTenants } from '@/features/platform/use-platform-tenants';
import { useInviteUser } from '@/features/platform/use-platform-users';
import { apiErrorMessage } from '@/lib/api-error';

export function UserInvitePage() {
  const navigate = useNavigate();
  const invite = useInviteUser();
  const { data: tenants } = usePlatformTenants();
  const [form, setForm] = useState({ email: '', displayName: '', tenantId: '' });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const result = await invite.mutateAsync(form);
      setInviteUrl(result.inviteUrl);
      alert('Convite enviado. Se o e-mail não estiver configurado, copie o link abaixo.');
    } catch (err) {
      alert(apiErrorMessage(err, 'Não foi possível enviar o convite.'));
    }
  };

  return (
    <div>
      <PageHeader title="Convidar utilizador" backTo="/users" />
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
        <FormField label="E-mail">
          <TextInput
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
        <FormField label="Nome a apresentar">
          <TextInput
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </FormField>
        <FormField label="Tenant">
          <SelectInput
            required
            value={form.tenantId}
            onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
          >
            <option value="">Selecionar tenant…</option>
            {(tenants?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </SelectInput>
        </FormField>
        {inviteUrl ? (
          <FormField label="Link do convite (cópia manual)" hint="Válido por 7 dias">
            <TextInput readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
          </FormField>
        ) : null}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={invite.isPending} className={btnPrimary}>
            {invite.isPending ? 'A enviar…' : 'Enviar convite'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate('/users')}>
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
