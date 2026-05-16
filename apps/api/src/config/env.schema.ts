import { z } from 'zod';

const role = () => ((process.env.PROCESS_ROLE ?? 'api').toLowerCase() === 'worker' ? 'worker' : 'api');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PROCESS_ROLE: z
      .preprocess(
        (v) => (typeof v === 'string' && v.toLowerCase().trim() === 'worker' ? 'worker' : 'api'),
        z.enum(['api', 'worker']),
      ),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
    REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatório'),
    WEB_URL: z.string().min(1).default('http://localhost:5173'),
    JWT_ACCESS_SECRET: z.string().min(1),
    JWT_REFRESH_SECRET: z.string().min(1),
    JWT_ACCESS_EXPIRES: z.string().default('15m'),
    JWT_REFRESH_EXPIRES: z.string().default('7d'),
    RESEND_API_KEY: z.string().optional(),
    SENTRY_DSN_API: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_TEAM_ID: z.string().optional(),
    APPLE_KEY_ID: z.string().optional(),
    ENCRYPTION_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.JWT_ACCESS_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres em produção',
          path: ['JWT_ACCESS_SECRET'],
        });
      }
      if (data.JWT_REFRESH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres em produção',
          path: ['JWT_REFRESH_SECRET'],
        });
      }
      if (!data.WEB_URL || data.WEB_URL === 'http://localhost:5173') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WEB_URL deve listar origens permitidas (CSV) em produção',
          path: ['WEB_URL'],
        });
      }
    }
    if (data.NODE_ENV === 'production' && data.PROCESS_ROLE === 'worker') {
      if (!data.RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RESEND_API_KEY é obrigatório para o worker em produção',
          path: ['RESEND_API_KEY'],
        });
      }
    }
  });

export type ValidatedEnv = z.infer<typeof envSchema>;

/** Valida process.env e encerra o processo com código 1 se inválido. */
export function validateEnv(): ValidatedEnv {
  const devDefaults =
    process.env.NODE_ENV !== 'production'
      ? {
          JWT_ACCESS_SECRET:
            process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32chars!!',
          JWT_REFRESH_SECRET:
            process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars!!',
        }
      : {};

  const merged = { ...process.env, ...devDefaults };
  const parsed = envSchema.safeParse(merged);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    console.error('Variáveis de ambiente inválidas:', JSON.stringify(msg, null, 2));
    console.error(parsed.error.message);
    process.exit(1);
  }
  return parsed.data;
}

export function getProcessRole(): 'api' | 'worker' {
  return role() === 'worker' ? 'worker' : 'api';
}
