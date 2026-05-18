import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/shared/api/client';

type ValidateResponse = {
  valid: boolean;
  email: string;
  displayName: string;
  tenant?: { slug: string; name: string };
};

export function InviteAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [info, setInfo] = useState<ValidateResponse | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link de convite inválido.');
      setLoading(false);
      return;
    }
    void api
      .get('/auth/invite/validate', { params: { token } })
      .then((res) => {
        const body = (res.data.data ?? res.data) as ValidateResponse;
        setInfo(body);
      })
      .catch(() => setError('Convite inválido ou expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/auth/invite/accept', { token, password });
      const body = res.data.data ?? res.data;
      const slug = body.tenantSlug as string | undefined;
      navigate(`/login${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`, { replace: true });
    } catch {
      setError('Não foi possível aceitar o convite. Verifique a senha (mín. 8 caracteres).');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
        A validar convite…
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 shadow-2xl">
        <h1 className="text-center text-2xl font-semibold text-white">Aceitar convite</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {info?.displayName} ({info?.email})
          {info?.tenant ? ` · ${info.tenant.name}` : ''}
        </p>
        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="password">
              Definir senha
            </label>
            <input
              id="password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'A guardar…' : 'Ativar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
