import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * API base URL (no /api suffix).
 * - Emulator: 10.0.2.2 → host localhost
 * - Physical device: your PC LAN IP, e.g. http://192.168.1.100:4000
 * Set EXPO_PUBLIC_API_URL in apps/mobile/.env before building the APK.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  return 'http://10.0.2.2:4000';
}

export const API_URL = resolveApiUrl();

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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
