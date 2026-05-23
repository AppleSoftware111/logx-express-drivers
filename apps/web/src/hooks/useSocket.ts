'use client';

import { useEffect } from 'react';

import { SOCKET_EVENTS } from '@logx/shared';

import { getAccessToken } from '@/lib/authToken';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';

/**
 * Keeps a single Socket.io connection in zustand (survives React Strict Mode remounts).
 * Only connects after AuthGuard has validated the session.
 */
export function useSocket() {
  const sessionValidated = useAuthStore((s) => s.sessionValidated);
  const storeToken = useAuthStore((s) => s.accessToken);
  const token = storeToken ?? getAccessToken();
  const { socket, connected, connect, disconnect } = useSocketStore();

  useEffect(() => {
    if (!sessionValidated || !token) {
      disconnect();
      return;
    }

    connect(token);
    // Do not disconnect on effect cleanup — React Strict Mode remounts would
    // close the socket before it finishes connecting.
  }, [sessionValidated, token, connect, disconnect]);

  return { socket, connected, SOCKET_EVENTS };
}
