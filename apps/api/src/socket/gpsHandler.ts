import type { Server, Socket } from 'socket.io';

import { DEFAULT_LOCALE, getNestedMessage } from '@logx/i18n';
import { SOCKET_EVENTS } from '@logx/shared';

import { Driver } from '../models/Driver.model';
import { checkGeofenceArrivals, bufferGpsPoint, updateDriverLocation } from '../modules/tracking/tracking.service';

export function registerGpsHandlers(io: Server, socket: Socket): void {
  const { driverId, companyId } = socket.data as {
    driverId?: string;
    companyId: string;
    role: string;
  };

  socket.on(
    SOCKET_EVENTS.DRIVER_LOCATION,
    async (payload: {
      executionId: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      recordedAt: string;
    }) => {
      if (!driverId) return;

      try {
        // Buffer point for bulk DB insert (include companyId for multi-tenant safety)
        bufferGpsPoint({
          driverId,
          executionId: payload.executionId,
          companyId,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed,
          heading: payload.heading,
          accuracy: payload.accuracy,
          recordedAt: payload.recordedAt ?? new Date().toISOString(),
        });

        // Update driver's latest position in DB
        await updateDriverLocation(driverId, payload.lat, payload.lng);

        // Broadcast to admin room
        io.to(`admin:${companyId}`).emit(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, {
          driverId,
          executionId: payload.executionId,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed,
          heading: payload.heading,
          timestamp: payload.recordedAt,
        });

        // Check geofence for auto-arrival
        const arrival = await checkGeofenceArrivals(
          payload.executionId,
          companyId,
          payload.lat,
          payload.lng
        );

        if (arrival) {
          // Notify the driver they arrived
          socket.emit(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, {
            stopId: arrival.stopId,
            clientName: arrival.clientName,
            message: (
              getNestedMessage(DEFAULT_LOCALE, 'notifications', 'geofenceDriverArrival') ??
              'Você chegou em {stopName}'
            ).replace('{stopName}', arrival.clientName),
          });

          // Notify admin
          io.to(`admin:${companyId}`).emit(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, {
            executionId: arrival.executionId,
            event: 'STOP_ARRIVED',
            stopId: arrival.stopId,
            clientName: arrival.clientName,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[gpsHandler] Error processing location:', msg);
      }
    }
  );

  socket.on(SOCKET_EVENTS.DRIVER_ONLINE, async () => {
    if (!driverId) return;
    await Driver.findByIdAndUpdate(driverId, { isOnline: true });
    io.to(`admin:${companyId}`).emit(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, {
      event: 'DRIVER_ONLINE',
      driverId,
    });
  });

  socket.on('disconnect', async () => {
    if (!driverId) return;
    await Driver.findByIdAndUpdate(driverId, { isOnline: false });
    io.to(`admin:${companyId}`).emit(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, {
      event: 'DRIVER_OFFLINE',
      driverId,
    });
  });
}
