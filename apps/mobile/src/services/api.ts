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
const USER_PROFILE_KEY = 'sessionUser';
const LOCAL_API_URL_PATTERN = /(10\.0\.2\.2|192\.168\.|localhost|127\.0\.0\.1)/i;
export const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;

type AuthFailureHandler = () => void | Promise<void>;
let authFailureHandler: AuthFailureHandler | null = null;
let refreshRequestPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;
let backgroundTaskContext = false;

export type StoredAuthUser = {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  driverId?: string;
  locale?: string;
};

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

export async function persistStoredUser(user: StoredAuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(user));
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_PROFILE_KEY),
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

export async function getStoredUser(): Promise<StoredAuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredAuthUser;
  } catch {
    await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
    return null;
  }
}

export function registerAuthFailureHandler(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler;
}

export function isRecoverableNetworkError(error: unknown): boolean {
  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number };
  };

  if (err.message === 'Missing refresh token') return false;
  if (!err.response) return true;
  if (err.code === 'ECONNABORTED') return true;

  return typeof err.response.status === 'number' && err.response.status >= 500;
}

export function isDefinitiveAuthFailure(error: unknown): boolean {
  const err = error as {
    response?: { status?: number };
  };

  return err.response?.status === 401 || err.response?.status === 403;
}

/**
 * Decode the expiry of a JWT without verifying its signature.
 * Returns the `exp` Unix timestamp in milliseconds, or 0 on failure.
 */
function jwtExpiresAtMs(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Ensures there is a valid (non-expired) access token in SecureStore.
 * Refreshes proactively when the token has less than 90 seconds of life left.
 * Safe to call from background task contexts where the interceptor may not fire.
 */
export async function ensureFreshToken(options?: { logoutOnFailure?: boolean }): Promise<boolean> {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (!token) {
      if (backgroundTaskContext) {
        return false;
      }
      await refreshAuthSession();
      return true;
    }

    const expiresAt = jwtExpiresAtMs(token);
    const msLeft = expiresAt - Date.now();
    if (msLeft < 90_000) {
      try {
        await refreshAuthSession();
        await syncStoredUserFromAccessToken();
      } catch (refreshError) {
        // In background, keep using the current access token if it has not expired yet.
        if (backgroundTaskContext && msLeft > 0) {
          return true;
        }
        throw refreshError;
      }
    }

    if (!(await ensureDriverClaimInAccessToken())) {
      return false;
    }
    return true;
  } catch (error) {
    if (backgroundTaskContext) {
      return false;
    }
    const shouldLogout = options?.logoutOnFailure !== false;
    if (shouldLogout && !isRecoverableNetworkError(error)) {
      await clearAuthSession();
      useAuthStore.getState().logout();
      await authFailureHandler?.();
    }
    return false;
  }
}

export function setBackgroundTaskContext(active: boolean): void {
  backgroundTaskContext = active;
}

/** Forces a refresh-token rotation to pick up new JWT claims (e.g. driverId after API deploy). */
export async function forceRefreshAuthSession(): Promise<boolean> {
  return rotateAuthSession();
}

/** Rotates the session and syncs driver claims into local storage. Works in background GPS context. */
export async function rotateAuthSession(): Promise<boolean> {
  try {
    await refreshAuthSession();
    await syncStoredUserFromAccessToken();
    return true;
  } catch {
    return false;
  }
}

function jwtPayloadField(token: string, field: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<
      string,
      unknown
    >;
    const value = decoded[field];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function syncStoredUserFromAccessToken(): Promise<void> {
  const [token, storedUser] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    getStoredUser(),
  ]);
  if (!token || !storedUser) return;

  const driverId = jwtPayloadField(token, 'driverId');
  if (!driverId || driverId === storedUser.driverId) return;

  const nextUser = { ...storedUser, driverId };
  await persistStoredUser(nextUser);
  useAuthStore.getState().updateUser({ driverId });
}

async function ensureDriverClaimInAccessToken(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) return false;

  const role = jwtPayloadField(token, 'role');
  if (role !== 'DRIVER') return true;
  if (jwtPayloadField(token, 'driverId')) return true;

  try {
    await refreshAuthSession();
    await syncStoredUserFromAccessToken();
    const refreshed = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return Boolean(refreshed && jwtPayloadField(refreshed, 'driverId'));
  } catch {
    return false;
  }
}

export async function getAccessTokenDriverId(): Promise<string | undefined> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) return undefined;
  return jwtPayloadField(token, 'driverId');
}

export type AuthTokenDiagnostics = {
  refreshTokenPresent: boolean;
  accessTokenExpiresAt: string | null;
  accessTokenMinutesLeft: number | null;
  refreshProbeStatus: 'ok' | 'missing_refresh' | 'failed' | 'not_probed';
  refreshTokenRotated: boolean;
  apiReturnsRotatedRefresh: boolean;
};

export async function getAuthTokenDiagnostics(options?: {
  probeRefresh?: boolean;
}): Promise<AuthTokenDiagnostics> {
  const session = await getStoredAuthSession();
  const accessToken = session.accessToken;
  const refreshTokenPresent = Boolean(session.refreshToken);

  let accessTokenExpiresAt: string | null = null;
  let accessTokenMinutesLeft: number | null = null;

  if (accessToken) {
    const expiresAtMs = jwtExpiresAtMs(accessToken);
    if (expiresAtMs > 0) {
      accessTokenExpiresAt = new Date(expiresAtMs).toISOString();
      accessTokenMinutesLeft = Math.max(0, Math.round((expiresAtMs - Date.now()) / 60_000));
    }
  }

  let refreshProbeStatus: AuthTokenDiagnostics['refreshProbeStatus'] = 'not_probed';
  let refreshTokenRotated = false;
  let apiReturnsRotatedRefresh = false;

  if (options?.probeRefresh) {
    if (!session.refreshToken) {
      refreshProbeStatus = 'missing_refresh';
    } else {
      const beforeRefresh = session.refreshToken;
      try {
        const rotated = await refreshAuthSession();
        refreshProbeStatus = 'ok';
        refreshTokenRotated = rotated.refreshToken !== beforeRefresh;
        apiReturnsRotatedRefresh = refreshTokenRotated;
      } catch {
        refreshProbeStatus = 'failed';
      }
    }
  }

  return {
    refreshTokenPresent,
    accessTokenExpiresAt,
    accessTokenMinutesLeft,
    refreshProbeStatus,
    refreshTokenRotated,
    apiReturnsRotatedRefresh,
  };
}

async function refreshAuthSession(): Promise<{ accessToken: string; refreshToken: string }> {
  if (refreshRequestPromise) {
    return refreshRequestPromise;
  }

  refreshRequestPromise = (async () => {
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
    const accessToken = body.success ? body.data.accessToken : undefined;
    const rotatedRefreshToken = body.success ? body.data.refreshToken : undefined;
    if (!accessToken) {
      throw new Error('Missing refreshed access token');
    }

    const nextRefreshToken = rotatedRefreshToken ?? refreshToken;
    await persistAuthSession(accessToken, nextRefreshToken);
    useAuthStore.getState().updateTokens(accessToken, nextRefreshToken);
    await syncStoredUserFromAccessToken();

    return {
      accessToken,
      refreshToken: nextRefreshToken,
    };
  })();

  try {
    return await refreshRequestPromise;
  } finally {
    refreshRequestPromise = null;
  }
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

    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
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
        const refreshed = await refreshAuthSession();
        if (!originalRequest.headers) {
          originalRequest.headers = {};
        }
        originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
        if (typeof FormData !== 'undefined' && originalRequest.data instanceof FormData) {
          delete originalRequest.headers['Content-Type'];
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (!isRecoverableNetworkError(refreshError)) {
          await clearAuthSession();
          useAuthStore.getState().logout();
          await authFailureHandler?.();
        }
      }
    }

    return Promise.reject(error);
  }
);
