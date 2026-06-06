import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from '@logx/shared';

import { getIO } from '.';

export type ExecutionRealtimeEvent =
  | 'EXECUTION_ASSIGNED'
  | 'EXECUTION_UPDATED'
  | 'EXECUTION_CANCELLED'
  | 'STATUS_CHANGED'
  | 'STOP_ARRIVED'
  | 'STOP_STARTED'
  | 'STOP_COMPLETED'
  | 'STOP_SKIPPED'
  | 'POD_SAVED'
  | 'DRIVER_SUBSTITUTED'
  | 'DELAY_UPDATED'
  | 'DRIVER_ONLINE'
  | 'DRIVER_OFFLINE';

export interface RealtimeExecutionPayload {
  event: ExecutionRealtimeEvent;
  executionId?: string;
  routeId?: string;
  routeName?: string;
  companyId?: string;
  driverId?: string;
  previousDriverId?: string;
  status?: string;
  stopId?: string;
  clientName?: string;
  scheduledTime?: string;
  timestamp: string;
}

export function emitDriverLocationUpdate(
  companyId: string,
  payload: {
    driverId: string;
    executionId?: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    timestamp: string;
  }
) {
  try {
    const io = getIO();
    io.to(SOCKET_ROOMS.adminRoom(companyId)).emit(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, payload);
  } catch {
    // Socket layer not available during tests/bootstrap.
  }
}

export function emitAdminAlert(companyId: string, payload: unknown) {
  try {
    const io = getIO();
    io.to(SOCKET_ROOMS.adminRoom(companyId)).emit(SOCKET_EVENTS.ADMIN_ALERT, payload);
  } catch {
    // Socket layer not available during tests/bootstrap.
  }
}

export function emitExecutionRealtimeUpdate(
  companyId: string,
  payload: RealtimeExecutionPayload,
  options?: {
    driverEvent?:
      | typeof SOCKET_EVENTS.DRIVER_ROUTE_ASSIGNED
      | typeof SOCKET_EVENTS.DRIVER_ROUTE_UPDATED
      | typeof SOCKET_EVENTS.DRIVER_ROUTE_CANCELLED;
    driverIds?: Array<string | undefined | null>;
  }
) {
  try {
    const io = getIO();
    const enrichedPayload = {
      ...payload,
      companyId,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    };

    io.to(SOCKET_ROOMS.adminRoom(companyId)).emit(
      SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE,
      enrichedPayload
    );

    if (payload.executionId) {
      io.to(SOCKET_ROOMS.executionRoom(payload.executionId)).emit(
        SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE,
        enrichedPayload
      );
    }

    const driverEvent = options?.driverEvent;
    if (driverEvent) {
      const uniqueDriverIds = [...new Set((options?.driverIds ?? []).filter(Boolean))] as string[];
      uniqueDriverIds.forEach((driverId) => {
        io.to(SOCKET_ROOMS.driverRoom(driverId)).emit(driverEvent, enrichedPayload);
      });
    }
  } catch {
    // Socket layer not available during tests/bootstrap.
  }
}
