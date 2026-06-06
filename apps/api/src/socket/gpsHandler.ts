import type { Server, Socket } from 'socket.io';

import { DEFAULT_LOCALE, formatMessage } from '@logx/i18n';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@logx/shared';

import { Driver } from '../models/Driver.model';
import { User } from '../models/User.model';
import { checkGeofenceArrivals, bufferGpsPoint, updateDriverLocation } from '../modules/tracking/tracking.service';
import { emitDriverLocationUpdate, emitExecutionRealtimeUpdate } from './realtime';

export function registerGpsHandlers(io: Server, socket: Socket): void {
  const { driverId, companyId, userId } = socket.data as {
    driverId?: string;
    companyId: string;
    userId?: string;
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

        emitDriverLocationUpdate(companyId, {
          driverId,
          executionId: payload.executionId,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed,
          heading: payload.heading,
          accuracy: payload.accuracy,
          timestamp: payload.recordedAt ?? new Date().toISOString(),
        });

        // Check geofence for auto-arrival
        const arrival = await checkGeofenceArrivals(
          payload.executionId,
          companyId,
          payload.lat,
          payload.lng
        );

        if (arrival) {
          const user = userId
            ? await User.findById(userId).select('locale').lean()
            : null;
          // Notify the driver they arrived
          socket.emit(SOCKET_EVENTS.DRIVER_ARRIVED_CONFIRMED, {
            stopId: arrival.stopId,
            clientName: arrival.clientName,
            message: formatMessage(
              user?.locale ?? DEFAULT_LOCALE,
              'notifications',
              'geofenceDriverArrival',
              { stopName: arrival.clientName },
              'You arrived at {stopName}'
            ),
          });

          emitExecutionRealtimeUpdate(companyId, {
            executionId: arrival.executionId,
            event: 'STOP_ARRIVED',
            stopId: arrival.stopId,
            clientName: arrival.clientName,
            driverId,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[gpsHandler] Error processing location:', msg);
      }
    }
  );

  socket.on(
    SOCKET_EVENTS.DRIVER_PRESENCE_LOCATION,
    async (payload: {
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      recordedAt?: string;
    }) => {
      if (!driverId) return;

      try {
        await updateDriverLocation(driverId, payload.lat, payload.lng);

        emitDriverLocationUpdate(companyId, {
          driverId,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed,
          heading: payload.heading,
          accuracy: payload.accuracy,
          timestamp: payload.recordedAt ?? new Date().toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[gpsHandler] Error processing presence location:', msg);
      }
    }
  );

  socket.on(SOCKET_EVENTS.DRIVER_ONLINE, async () => {
    if (!driverId) return;
    await Driver.findByIdAndUpdate(driverId, { isOnline: true });
    emitExecutionRealtimeUpdate(companyId, {
      event: 'DRIVER_ONLINE',
      driverId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', async () => {
    if (!driverId) return;

    const remainingConnections =
      io.sockets.adapter.rooms.get(SOCKET_ROOMS.driverRoom(driverId))?.size ?? 0;
    if (remainingConnections > 0) {
      return;
    }

    await Driver.findByIdAndUpdate(driverId, { isOnline: false });
    emitExecutionRealtimeUpdate(companyId, {
      event: 'DRIVER_OFFLINE',
      driverId,
      timestamp: new Date().toISOString(),
    });
  });
}
