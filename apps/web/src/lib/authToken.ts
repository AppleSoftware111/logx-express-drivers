import { useAuthStore } from '@/stores/authStore';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStore = useAuthStore.getState().accessToken;
  if (fromStore) return fromStore;
  return localStorage.getItem('accessToken');
}

/** True when the session was validated (login or AuthGuard /auth/me). */
export function useHasAccessToken(): boolean {
  const sessionValidated = useAuthStore((s) => s.sessionValidated);
  const accessToken = useAuthStore((s) => s.accessToken);
  return sessionValidated && !!accessToken;
}
