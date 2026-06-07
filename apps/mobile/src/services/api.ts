import axios, { create } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import type { ApiResponse } from '@logx/shared';

import { useAuthStore } from '../stores/authStore';
import { useLocaleStore } from '../stores/localeStore';

/**
 * API base URL (no /api suffix).
 * - Emulator: 10.0.2.2 → host localhost
 * - Physical device: your PC LAN IP, e.g. http://192.168.1.100:4000
 * Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl for all non-dev builds.
 */
const DEV_FALLBACK_API_URL = 'http://10.0.2.2:4000';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const LOCAL_API_URL_PATTERN = /(10\.0\.2\.2|192\.168\.|localhost|127\.0\.0\.1)/i;

type AuthFailureHandler = () => void | Promise<void>;
let authFailureHandler: AuthFailureHandler | null = null;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  if (__DEV__) {
    return DEV_FALLBACK_API_URL;
  }

  throw new Error(
    'Missing mobile API URL. Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl before building.'
  );
}

export const API_URL = resolveApiUrl();

if (!__DEV__ && LOCAL_API_URL_PATTERN.test(API_URL)) {
  console.warn(
    '[mobile-api] Non-development build is using a local/private API URL:',
    API_URL
  );
}

export async function persistAuthSession(accessToken: string, refreshToken?: string | null): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export async function getStoredAuthSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  return { accessToken, refreshToken };
}

export function registerAuthFailureHandler(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler;
}

export const apiClient = create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (config.headers) {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Accept-Language'] = useLocaleStore.getState().locale;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error('Missing refresh token');
        }

        const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>(
          `${API_URL}/api/auth/refresh`,
          { refreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept-Language': useLocaleStore.getState().locale,
            },
          }
        );

        const body = res.data;
        const newToken = body.success ? body.data.accessToken : undefined;
        const rotatedRefreshToken = body.success ? body.data.refreshToken : undefined;
        if (newToken) {
          await persistAuthSession(newToken, rotatedRefreshToken ?? refreshToken);
          useAuthStore.getState().updateAccessToken(newToken);
          if (!originalRequest.headers) {
            originalRequest.headers = {};
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        await clearAuthSession();
        useAuthStore.getState().logout();
        await authFailureHandler?.();
      }
    }

    return Promise.reject(error);
  }
);
