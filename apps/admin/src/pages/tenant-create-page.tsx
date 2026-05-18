import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput, TextInput } from '@/components/form-field';
import { btnPrimary, btnSecondary } from '@/components/ui-buttons';
import { useCreateTenant } from '@/features/platform/use-platform-tenants';
import { apiErrorMessage } from '@/lib/api-error';

export function TenantCreatePage() {
  const navigate = useNavigate();
  const create = useCreateTenant();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    legalName: '',
    countryCode: 'BR',
    taxId: '',
    timezone: 'America/Sao_Paulo',
    defaultLanguage: 'pt-BR',
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tenant = await create.mutateAsync({
        name: form.name,
        slug: form.slug.toLowerCase(),
        legalName: form.legalName || undefined,
        countryCode: form.countryCode,
        taxId: form.taxId || undefined,
        timezone: form.timezone,
        defaultLanguage: form.defaultLanguage,
      });
      navigate(`/tenants/${tenant.id}`);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title="Criar tenant" backTo="/tenants" />
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
        <FormField label="Nome">
          <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Slug" hint="Apenas minúsculas, números e hífen">
          <TextInput
            required
            pattern="^[a-z0-9-]+$"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
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
          <button type="submit" disabled={create.isPending} className={btnPrimary}>
            {create.isPending ? 'A guardar…' : 'Criar'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate('/tenants')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
