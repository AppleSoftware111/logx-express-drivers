import type { GpsPointInput } from '@logx/shared';
import {
  DRIVER_LOCATION_STALE_WINDOW_MS,
  GEOFENCE_RADIUS_METERS,
} from '@logx/shared';

import { Client } from '../../models/Client.model';
import { Driver } from '../../models/Driver.model';
import { GpsPoint } from '../../models/GpsPoint.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import { RouteExecutionAudit } from '../../models/RouteExecutionAudit.model';
import { syncExecutionLifecycle, touchDashboard } from '../executions/execution.service';
import { haversineDistance, isWithinRadius } from '../../utils/haversine';

interface BufferedGpsPoint extends GpsPointInput {
  companyId: string;
}

interface GpsBuffer {
  [executionId: string]: BufferedGpsPoint[];
}

// In-memory GPS buffer, flushed to DB every 30s
const gpsBuffer: GpsBuffer = {};

export function bufferGpsPoint(data: GpsPointInput & { companyId: string }): void {
  if (!gpsBuffer[data.executionId]) {
    gpsBuffer[data.executionId] = [];
  }
  gpsBuffer[data.executionId].push(data);
}

export async function flushGpsBuffer(): Promise<number> {
  const allPoints: BufferedGpsPoint[] = Object.values(gpsBuffer).flat();
  if (allPoints.length === 0) return 0;

  // Clear buffer before async insert to avoid duplicate flush
  Object.keys(gpsBuffer).forEach((key) => {
    delete gpsBuffer[key];
  });

  const docs = allPoints.map((p) => ({
    executionId: p.executionId,
    driverId: p.driverId,
    companyId: p.companyId,
    location: { type: 'Point' as const, coordinates: [p.lng, p.lat] as [number, number] },
    speed: p.speed,
    heading: p.heading,
    accuracy: p.accuracy,
    recordedAt: new Date(p.recordedAt),
  }));

  await GpsPoint.insertMany(docs, { ordered: false });
  return docs.length;
}

export async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number
): Promise<void> {
  await Driver.findByIdAndUpdate(driverId, {
    $set: {
      currentLocation: { lat, lng, updatedAt: new Date() },
      isOnline: true,
    },
  });
}

export async function processDriverGpsPayload(
  companyId: string,
  driverId: string,
  payload: Omit<GpsPointInput, 'driverId'>
): Promise<{ executionId: string; stopId: string; clientName: string } | null> {
  bufferGpsPoint({
    driverId,
    executionId: payload.executionId,
    companyId,
    lat: payload.lat,
    lng: payload.lng,
    speed: payload.speed,
    heading: payload.heading,
    accuracy: payload.accuracy,
    recordedAt: payload.recordedAt,
  });

  await updateDriverLocation(driverId, payload.lat, payload.lng);

  return checkGeofenceArrivals(payload.executionId, companyId, payload.lat, payload.lng);
}

/**
 * Check if the driver is within GEOFENCE_RADIUS_METERS of any pending stops.
 * If so, auto-set the stop to ARRIVED.
 * Returns the executionId and stopId if triggered, otherwise null.
 */
export async function checkGeofenceArrivals(
  executionId: string,
  companyId: string,
  lat: number,
  lng: number
): Promise<{ executionId: string; stopId: string; clientName: string } | null> {
  const execution = await RouteExecution.findOne({ _id: executionId, companyId })
    .populate('stops.clientId', 'name location')
    .exec();

  if (!execution || !['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(execution.status)) {
    return null;
  }

  for (const stop of execution.stops) {
    if (!['PENDING', 'ON_THE_WAY'].includes(stop.status)) continue;

    const targetLat = stop.location.lat;
    const targetLng = stop.location.lng;

    if (isWithinRadius(lat, lng, targetLat, targetLng, GEOFENCE_RADIUS_METERS)) {
      stop.status = 'ARRIVED';
      stop.arrivedAt = new Date();
      stop.arrivalLocation = { lat, lng };
      stop.arrivalDistanceMeters = Math.round(
        haversineDistance(lat, lng, targetLat, targetLng)
      );

      // Auto-progress execution to IN_PROGRESS on first arrival
      if (execution.status === 'ASSIGNED' || execution.status === 'ACCEPTED') {
        execution.status = 'IN_PROGRESS';
        if (!execution.actualStartTime) {
          execution.actualStartTime = new Date();
        }
      }

      syncExecutionLifecycle(execution);
      await execution.save();
      await RouteExecutionAudit.create({
        companyId,
        routeId: execution.routeId,
        executionId: execution._id,
        stopId: stop._id,
        action: 'STOP_ARRIVED',
        driverId: execution.driverId,
        clientEventId: `geofence:${execution._id}:${stop._id}:${stop.arrivedAt.toISOString()}`,
        occurredAt: stop.arrivedAt,
        serverReceivedAt: new Date(),
        source: 'geofence',
        gps: {
          lat,
          lng,
          recordedAt: stop.arrivedAt,
        },
        expectedLocation: {
          lat: targetLat,
          lng: targetLng,
        },
        distanceMeters: stop.arrivalDistanceMeters,
      });
      touchDashboard(companyId);

      // Get the client name from populated data
      const client = await Client.findById(stop.clientId).select('name').lean();

      return {
        executionId: execution._id.toString(),
        stopId: stop._id.toString(),
        clientName: client?.name ?? 'Unknown',
      };
    }
  }

  return null;
}

export async function getOnlineDrivers(companyId: string) {
  const staleCutoff = new Date(Date.now() - DRIVER_LOCATION_STALE_WINDOW_MS);

  return Driver.find({
    companyId,
    isActive: true,
    $or: [
      { isOnline: true },
      { 'currentLocation.updatedAt': { $gte: staleCutoff } },
    ],
  })
    .select('name currentLocation vehicleId')
    .populate('vehicleId', 'plate type')
    .lean();
}
