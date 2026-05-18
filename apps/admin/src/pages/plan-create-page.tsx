import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput, TextInput } from '@/components/form-field';
import { btnPrimary, btnSecondary } from '@/components/ui-buttons';
import { useCreatePlan } from '@/features/platform/use-platform-subscriptions';
import { apiErrorMessage } from '@/lib/api-error';

export function PlanCreatePage() {
  const navigate = useNavigate();
  const create = useCreatePlan();
  const [form, setForm] = useState({
    code: '',
    name: '',
    planType: 'STARTER',
    priceCents: 0,
    currency: 'BRL',
    billingCycle: 'monthly',
    trialDays: 14,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const plan = await create.mutateAsync({
        ...form,
        priceCents: Number(form.priceCents),
        trialDays: Number(form.trialDays),
      });
      navigate(`/subscriptions/plans/${plan.id}`);
    } catch (err) {
      alert(apiErrorMessage(err, 'Não foi possível criar o plano.'));
    }
  };

  return (
    <div>
      <PageHeader title="Criar plano" backTo="/subscriptions/plans" />
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
        <FormField label="Código">
          <TextInput required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </FormField>
        <FormField label="Nome">
          <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Tipo">
          <SelectInput value={form.planType} onChange={(e) => setForm({ ...form, planType: e.target.value })}>
            <option value="STARTER">STARTER</option>
            <option value="PROFESSIONAL">PROFESSIONAL</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </SelectInput>
        </FormField>
        <FormField label="Preço (centavos)">
          <TextInput
            type="number"
            min={0}
            value={form.priceCents}
            onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="Moeda">
          <TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </FormField>
        <FormField label="Ciclo de faturação">
          <TextInput
            value={form.billingCycle}
            onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
          />
        </FormField>
        <FormField label="Dias de trial">
          <TextInput
            type="number"
            min={0}
            value={form.trialDays}
            onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}
          />
        </FormField>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={create.isPending} className={btnPrimary}>
            {create.isPending ? 'A guardar…' : 'Criar'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate('/subscriptions/plans')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
