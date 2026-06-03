import axios, { create } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { useLocaleStore } from '../stores/localeStore';

/**
 * API base URL (no /api suffix).
 * - Emulator: 10.0.2.2 → host localhost
 * - Physical device: your PC LAN IP, e.g. http://192.168.1.100:4000
 * Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl for all non-dev builds.
 */
const DEV_FALLBACK_API_URL = 'http://10.0.2.2:4000';

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

export const apiClient = create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
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
        const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, {
          withCredentials: true,
        });
        const newToken = res.data.data?.accessToken;
        if (newToken) {
          await SecureStore.setItemAsync('accessToken', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
      }
    }

    return Promise.reject(error);
  }
);
