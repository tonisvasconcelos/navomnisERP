import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import { usePlatformAuthStore } from '@/store/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = usePlatformAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('admin@platform.navomnis.local');
  const [password, setPassword] = useState('Platform123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const login = await platformApi.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
        '/platform/auth/login',
        { email, password },
      );
      const { accessToken, refreshToken } = login.data.data;
      const me = await platformApi.get<ApiEnvelope<{ email: string; displayName: string; permissions: string[] }>>(
        '/platform/auth/me',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setSession({
        accessToken,
        refreshToken,
        email: me.data.data.email,
        displayName: me.data.data.displayName,
        permissions: me.data.data.permissions,
      });
      navigate('/');
    } catch {
      setError('Credenciais inválidas ou API indisponível.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold text-white">Platform Admin</h1>
        <p className="mb-6 text-sm text-slate-400">Acesso restrito a operadores Navomnis</p>
        {error && <p className="mb-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-200">{error}</p>}
        <label className="mb-4 block text-sm text-slate-300">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="mb-6 block text-sm text-slate-300">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
