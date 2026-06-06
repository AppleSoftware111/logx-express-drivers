import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { SOCKET_EVENTS } from '@logx/shared';

import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';

type DriverRouteRealtimePayload = {
  event: string;
  executionId?: string;
  routeId?: string;
  driverId?: string;
  status?: string;
  stopId?: string;
  timestamp?: string;
};

export function useDriverRealtime() {
  const queryClient = useQueryClient();
  const { accessToken, isAuthenticated } = useAuthStore();
  const socket = useSocketStore((state) => state.socket);
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnect();
      return;
    }

    connect(accessToken);
  }, [accessToken, connect, disconnect, isAuthenticated]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const invalidateExecutionState = (payload?: DriverRouteRealtimePayload) => {
      void queryClient.invalidateQueries({ queryKey: ['today-routes'] });

      if (payload?.executionId) {
        void queryClient.invalidateQueries({ queryKey: ['execution', payload.executionId] });
        void queryClient.invalidateQueries({ queryKey: ['execution-alerts', payload.executionId] });
      }
    };

    const handleConnect = () => {
      socket.emit(SOCKET_EVENTS.DRIVER_ONLINE);
      invalidateExecutionState();
    };

    const handleRouteChanged = (payload: DriverRouteRealtimePayload) => {
      invalidateExecutionState(payload);
    };

    const handleAppStateChange = (nextState: string) => {
      if (nextState !== 'active') return;

      if (!socket.connected) {
        socket.connect();
      }

      invalidateExecutionState();
    };

    socket.on('connect', handleConnect);
    socket.on(SOCKET_EVENTS.DRIVER_ROUTE_ASSIGNED, handleRouteChanged);
    socket.on(SOCKET_EVENTS.DRIVER_ROUTE_UPDATED, handleRouteChanged);
    socket.on(SOCKET_EVENTS.DRIVER_ROUTE_CANCELLED, handleRouteChanged);
    socket.on(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, handleRouteChanged);

    if (socket.connected) {
      handleConnect();
    }

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      socket.off('connect', handleConnect);
      socket.off(SOCKET_EVENTS.DRIVER_ROUTE_ASSIGNED, handleRouteChanged);
      socket.off(SOCKET_EVENTS.DRIVER_ROUTE_UPDATED, handleRouteChanged);
      socket.off(SOCKET_EVENTS.DRIVER_ROUTE_CANCELLED, handleRouteChanged);
      socket.off(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, handleRouteChanged);
      appStateSubscription.remove();
    };
  }, [isAuthenticated, queryClient, socket]);
}
