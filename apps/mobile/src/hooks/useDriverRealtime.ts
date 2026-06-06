import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { SOCKET_EVENTS } from '@logx/shared';

import { useAuthStore } from '../stores/authStore';
import { getCurrentLocation } from '../services/gpsService';
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

    const emitPresenceLocation = async () => {
      const location = await getCurrentLocation();
      if (!location) return;

      socket.emit(SOCKET_EVENTS.DRIVER_PRESENCE_LOCATION, {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        speed: location.coords.speed ?? undefined,
        heading: location.coords.heading ?? undefined,
        accuracy: location.coords.accuracy ?? undefined,
        recordedAt: new Date(location.timestamp).toISOString(),
      });
    };

    const invalidateExecutionState = (payload?: DriverRouteRealtimePayload) => {
      void queryClient.invalidateQueries({ queryKey: ['today-routes'] });

      if (payload?.executionId) {
        void queryClient.invalidateQueries({ queryKey: ['execution', payload.executionId] });
        void queryClient.invalidateQueries({ queryKey: ['execution-alerts', payload.executionId] });
      }
    };

    const handleConnect = () => {
      socket.emit(SOCKET_EVENTS.DRIVER_ONLINE);
      void emitPresenceLocation();
      invalidateExecutionState();
    };

    const handleRouteChanged = (payload: DriverRouteRealtimePayload) => {
      invalidateExecutionState(payload);
    };

    const handleAppStateChange = (nextState: string) => {
      if (nextState !== 'active') return;

      if (!socket.connected) {
        socket.connect();
      } else {
        void emitPresenceLocation();
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
