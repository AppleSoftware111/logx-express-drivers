import { getClientLocale } from '@/lib/locale';
import { resolveApiErrorMessage } from '@logx/i18n';

export function getApiErrorFromResponse(error: unknown): string {
  const locale = getClientLocale();
  const axiosErr = error as {
    response?: { data?: { error?: string | { code?: string; message?: string } } };
  };
  const body = axiosErr.response?.data;
  if (body) {
    return resolveApiErrorMessage(body, locale);
  }
  if (error instanceof Error) return error.message;
  return resolveApiErrorMessage({}, locale);
}

/** @param fallback Shown when the error body cannot be parsed */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const msg = getApiErrorFromResponse(error);
  if (msg && msg !== 'INTERNAL_ERROR') return msg;
  return fallback;
}
