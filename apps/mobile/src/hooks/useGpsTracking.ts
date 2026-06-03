import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { SOCKET_EVENTS } from '@logx/shared';

import { API_URL } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  startBackgroundGps,
  stopBackgroundGps,
  setGpsCallback,
  type GpsPayload,
} from '../services/gpsService';

export function useGpsTracking(executionId: string | null, isActive: boolean) {
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isActive || !executionId || !accessToken) {
      void stopBackgroundGps();
      socketRef.current?.disconnect();
      return;
    }

    // Connect socket
    socketRef.current = io(API_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.info('[gps] Socket connected');
    });

    socketRef.current.on(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, (data: { clientName: string; stopId: string }) => {
      // Notify the driver (handled in screen)
      console.info(`[gps] Arrived at ${data.clientName}`);
    });

    // Set GPS callback to emit via socket
    setGpsCallback((payload: GpsPayload) => {
      socketRef.current?.emit(SOCKET_EVENTS.DRIVER_LOCATION, payload);
    });

    // Start background GPS
    void startBackgroundGps(executionId);

    return () => {
      void stopBackgroundGps();
      socketRef.current?.disconnect();
    };
  }, [isActive, executionId, accessToken]);

  return { socket: socketRef.current };
}
