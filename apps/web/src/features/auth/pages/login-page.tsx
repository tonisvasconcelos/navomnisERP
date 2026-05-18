import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth-store';
import { LoginBackgroundCarousel } from '../components/login-background-carousel';
import { api } from '@/shared/api/client';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  tenantSlug: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const { data: body } = await api.post('/auth/login', {
        email: values.email,
        password: values.password,
        tenantSlug: values.tenantSlug || undefined,
      });
      const payload = body.data ?? body;
      setSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        tenantId: payload.tenantId,
      });
      navigate('/');
    } catch {
      setError('root', { message: t('errors.generic') });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <LoginBackgroundCarousel />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 shadow-2xl backdrop-blur"
      >
        <h1 className="text-center text-2xl font-semibold text-white">Navomnis ERP</h1>
        <p className="mt-1 text-center text-sm text-slate-400">Entre na sua organização</p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="email">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none ring-blue-500 focus:ring-2"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="password">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none ring-blue-500 focus:ring-2"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="tenant">
              Tenant (slug)
            </label>
            <input
              id="tenant"
              placeholder="demo"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none ring-blue-500 focus:ring-2"
              {...register('tenantSlug')}
            />
          </div>
          {errors.root && (
            <p className="text-center text-sm text-red-400">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {t('auth.login')}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          Ambiente demo: tenant <code className="text-slate-400">demo</code>
        </p>
      </motion.div>
    </div>
  );
}
