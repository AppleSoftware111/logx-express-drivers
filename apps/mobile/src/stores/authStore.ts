import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  driverId?: string;
  locale?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken?: string | null) => void;
  updateTokens: (accessToken: string, refreshToken?: string | null) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken, refreshToken = null) =>
    set({ user, accessToken, refreshToken, isAuthenticated: true }),
  updateTokens: (accessToken, refreshToken) =>
    set((state) => ({
      ...state,
      accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
    })),
  updateUser: (patch) =>
    set((state) => ({
      ...state,
      user: state.user ? { ...state.user, ...patch } : state.user,
    })),
  logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
}));
