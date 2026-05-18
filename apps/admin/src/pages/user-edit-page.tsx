import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { FormField, SelectInput, TextInput } from '@/components/form-field';
import { btnPrimary, btnSecondary } from '@/components/ui-buttons';
import { usePlatformUser, useUpdateUser } from '@/features/platform/use-platform-users';
import { apiErrorMessage } from '@/lib/api-error';

export function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading } = usePlatformUser(id);
  const update = useUpdateUser(id ?? '');
  const [form, setForm] = useState({ displayName: '', locale: 'pt-BR' });

  useEffect(() => {
    if (user) {
      setForm({ displayName: user.displayName, locale: user.locale ?? 'pt-BR' });
    }
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      navigate(`/users/${id}`);
    } catch (err) {
      alert(apiErrorMessage(err, 'Não foi possível atualizar o utilizador.'));
    }
  };

  if (isLoading || !user) {
    return <p className="text-slate-400">Carregando…</p>;
  }

  return (
    <div>
      <PageHeader title={`Editar: ${user.displayName}`} backTo={`/users/${id}`} />
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
        <FormField label="Nome a apresentar">
          <TextInput
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </FormField>
        <FormField label="Locale">
          <SelectInput value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
            <option value="pt-BR">pt-BR</option>
            <option value="en-US">en-US</option>
          </SelectInput>
        </FormField>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={update.isPending} className={btnPrimary}>
            {update.isPending ? 'A guardar…' : 'Guardar'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate(`/users/${id}`)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
