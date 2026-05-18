import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput, TextInput } from '@/components/form-field';
import { btnPrimary, btnSecondary } from '@/components/ui-buttons';
import { usePlatformTenant, useUpdateTenant } from '@/features/platform/use-platform-tenants';
import { apiErrorMessage } from '@/lib/api-error';

export function TenantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading } = usePlatformTenant(id);
  const update = useUpdateTenant(id ?? '');
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    countryCode: 'BR',
    taxId: '',
    timezone: 'America/Sao_Paulo',
    defaultLanguage: 'pt-BR',
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name,
        legalName: tenant.legalName ?? '',
        countryCode: tenant.countryCode ?? 'BR',
        taxId: tenant.taxId ?? '',
        timezone: tenant.timezone ?? 'America/Sao_Paulo',
        defaultLanguage: tenant.defaultLanguage ?? 'pt-BR',
      });
    }
  }, [tenant]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        name: form.name,
        legalName: form.legalName || undefined,
        countryCode: form.countryCode,
        taxId: form.taxId || undefined,
        timezone: form.timezone,
        defaultLanguage: form.defaultLanguage,
      });
      navigate(`/tenants/${id}`);
    } catch (err) {
      alert(apiErrorMessage(err, 'Não foi possível atualizar o tenant.'));
    }
  };

  if (isLoading || !tenant) {
    return <p className="text-slate-400">Carregando…</p>;
  }

  return (
    <div>
      <PageHeader title={`Editar: ${tenant.name}`} backTo={`/tenants/${id}`} />
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
        <FormField label="Nome">
          <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Razão social">
          <TextInput value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </FormField>
        <FormField label="País (ISO)">
          <TextInput value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} />
        </FormField>
        <FormField label="CNPJ / Tax ID">
          <TextInput value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
        </FormField>
        <FormField label="Fuso horário">
          <TextInput value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        </FormField>
        <FormField label="Idioma padrão">
          <SelectInput value={form.defaultLanguage} onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}>
            <option value="pt-BR">pt-BR</option>
            <option value="en-US">en-US</option>
          </SelectInput>
        </FormField>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={update.isPending} className={btnPrimary}>
            {update.isPending ? 'A guardar…' : 'Guardar'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate(`/tenants/${id}`)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
