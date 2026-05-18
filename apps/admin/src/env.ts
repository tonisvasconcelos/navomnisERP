import { z } from 'zod';

const raw = {
  MODE: import.meta.env.MODE,
  VITE_API_URL: import.meta.env.VITE_API_URL,
};

const schema = z
  .object({
    MODE: z.enum(['development', 'production', 'test']),
    VITE_API_URL: z.string().optional(),
  })
  .transform((data) => {
    const trimmed = (data.VITE_API_URL ?? '').trim();
    let VITE_API_URL = trimmed;
    if (!VITE_API_URL) {
      VITE_API_URL = data.MODE === 'production' ? '' : 'http://localhost:4000/api/v1';
    }
    return { ...data, VITE_API_URL };
  })
  .pipe(
    z.object({
      MODE: z.enum(['development', 'production', 'test']),
      VITE_API_URL: z.string().url(),
    }),
  );

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('[env] Configuração inválida:', parsed.error.flatten().fieldErrors);
  throw new Error('Variáveis de ambiente do frontend inválidas.');
}

export const env = parsed.data;
