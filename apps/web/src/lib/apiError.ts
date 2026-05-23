import type { AxiosError } from 'axios';

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<{ error?: string; details?: Record<string, string[]> }>;
    const data = axiosError.response?.data;
    if (data?.error) return data.error;
    if (data?.details) {
      const first = Object.values(data.details).flat()[0];
      if (first) return first;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
