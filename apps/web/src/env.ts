import { z } from 'zod';

const raw = {
  MODE: import.meta.env.MODE,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_PUSH_PUBLIC_KEY: import.meta.env.VITE_PUSH_PUBLIC_KEY,
  VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  VITE_APPLE_CLIENT_ID: import.meta.env.VITE_APPLE_CLIENT_ID,
};

const schema = z
  .object({
    MODE: z.enum(['development', 'production', 'test']),
    VITE_API_URL: z.string().optional(),
    VITE_APP_ENV: z.enum(['development', 'preview', 'production']).optional(),
    VITE_SENTRY_DSN: z.string().optional(),
    VITE_PUSH_PUBLIC_KEY: z.string().optional(),
    VITE_GOOGLE_CLIENT_ID: z.string().optional(),
    VITE_APPLE_CLIENT_ID: z.string().optional(),
  })
  .transform((data) => {
    const trimmed = (data.VITE_API_URL ?? '').trim();
    let VITE_API_URL = trimmed;
    if (!VITE_API_URL) {
      VITE_API_URL = data.MODE === 'production' ? '' : 'http://localhost:4000/api/v1';
    }
    const sentry = (data.VITE_SENTRY_DSN ?? '').trim();
    return {
      ...data,
      VITE_API_URL,
      VITE_SENTRY_DSN: sentry.length > 0 ? sentry : undefined,
    };
  })
  .pipe(
    z.object({
      MODE: z.enum(['development', 'production', 'test']),
      VITE_API_URL: z.string().url(),
      VITE_APP_ENV: z.enum(['development', 'preview', 'production']).optional(),
      VITE_SENTRY_DSN: z.string().url().optional(),
      VITE_PUSH_PUBLIC_KEY: z.string().optional(),
      VITE_GOOGLE_CLIENT_ID: z.string().optional(),
      VITE_APPLE_CLIENT_ID: z.string().optional(),
    }),
  );

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('[env] Configuração inválida:', parsed.error.flatten().fieldErrors);
  throw new Error('Variáveis de ambiente do frontend inválidas.');
}

export const env = parsed.data;

export function isProductionBuild(): boolean {
  return env.MODE === 'production';
}
