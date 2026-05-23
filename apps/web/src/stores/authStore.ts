import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useSocketStore } from './socketStore';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  driverId?: string;
  clientId?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** True after login or AuthGuard /auth/me validation — gates API queries */
  sessionValidated: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setSessionValidated: (validated: boolean) => void;
  logout: () => void;
}

function syncAccessTokenToStorage(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      sessionValidated: false,
      setAuth: (user, accessToken) => {
        syncAccessTokenToStorage(accessToken);
        set({ user, accessToken, isAuthenticated: true, sessionValidated: true });
      },
      setAccessToken: (token) => {
        syncAccessTokenToStorage(token);
        set({ accessToken: token, isAuthenticated: true, sessionValidated: true });
      },
      setSessionValidated: (validated) => set({ sessionValidated: validated }),
      logout: () => {
        useSocketStore.getState().disconnect();
        syncAccessTokenToStorage(null);
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          sessionValidated: false,
        });
      },
    }),
    {
      name: 'logx-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          state.isAuthenticated = true;
          state.sessionValidated = false;
          syncAccessTokenToStorage(state.accessToken);
        }
      },
    }
  )
);
