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
  updateAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken, refreshToken = null) =>
    set({ user, accessToken, refreshToken, isAuthenticated: true }),
  updateAccessToken: (accessToken) => set((state) => ({ ...state, accessToken })),
  logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
}));
