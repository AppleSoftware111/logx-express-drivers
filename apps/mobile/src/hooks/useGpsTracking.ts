import { useEffect } from 'react';

import { SOCKET_EVENTS } from '@logx/shared';

import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';
import {
  consumeQueuedGpsPayloads,
  getTrackedExecutionId,
  startBackgroundGps,
  stopBackgroundGps,
  setGpsCallback,
  type GpsPayload,
} from '../services/gpsService';

export function useGpsTracking(executionId: string | null, isActive: boolean) {
  const { accessToken } = useAuthStore();
  const socket = useSocketStore((state) => state.socket);

  useEffect(() => {
    if (!isActive || !executionId || !accessToken) {
      void stopBackgroundGps();
      setGpsCallback(null);
      return;
    }

    const flushQueuedPayloads = () => {
      void consumeQueuedGpsPayloads().then((payloads) => {
        payloads.forEach((payload) => {
          useSocketStore.getState().socket?.emit(SOCKET_EVENTS.DRIVER_LOCATION, payload);
        });
      });
    };

    if (socket?.connected) {
      flushQueuedPayloads();
    }

    const handleArrivalConfirmed = (data: { clientName: string; stopId: string }) => {
      // Notify the driver (handled in screen)
      console.info(`[gps] Arrived at ${data.clientName}`);
    };

    socket?.on('connect', flushQueuedPayloads);
    socket?.on(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, handleArrivalConfirmed);

    // Set GPS callback to emit via socket
    setGpsCallback(async (payload: GpsPayload) => {
      const activeSocket = useSocketStore.getState().socket;
      if (!activeSocket?.connected) {
        return false;
      }
      activeSocket.emit(SOCKET_EVENTS.DRIVER_LOCATION, payload);
      return true;
    });

    // Start background GPS
    void (async () => {
      const trackedExecutionId = await getTrackedExecutionId();
      if (trackedExecutionId !== executionId) {
        await startBackgroundGps(executionId);
      }
    })();

    return () => {
      socket?.off('connect', flushQueuedPayloads);
      socket?.off(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, handleArrivalConfirmed);
      setGpsCallback(null);
    };
  }, [isActive, executionId, accessToken, socket]);

  return { socket };
}
