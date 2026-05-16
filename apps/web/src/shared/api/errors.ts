import { isAxiosError } from 'axios';

/** Mensagem legível a partir da envelope de erro da API ou do Axios. */
export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro.'): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as
      | { errors?: { message?: string }[]; message?: string }
      | undefined;
    const fromEnvelope = body?.errors?.[0]?.message ?? body?.message;
    if (fromEnvelope) {
      return fromEnvelope;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
