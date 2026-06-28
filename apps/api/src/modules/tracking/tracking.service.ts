import type { GpsPointInput } from '@logx/shared';
import { DRIVER_LOCATION_STALE_WINDOW_MS } from '@logx/shared';

import { Client } from '../../models/Client.model';
import { Driver } from '../../models/Driver.model';
import { GpsPoint } from '../../models/GpsPoint.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import { RouteExecutionAudit } from '../../models/RouteExecutionAudit.model';
import { syncExecutionLifecycle, touchDashboard } from '../executions/execution.service';
import {
  findGeofenceEligibleStop,
  shouldTriggerGeofenceArrival,
} from './geofence.service';

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

  return checkGeofenceArrivals(payload.executionId, companyId, {
    lat: payload.lat,
    lng: payload.lng,
    accuracy: payload.accuracy,
    speed: payload.speed,
  });
}

/**
 * Auto-arrive only the current stop in route order when GPS is within geofence
 * and accuracy/speed guards pass.
 */
export async function checkGeofenceArrivals(
  executionId: string,
  companyId: string,
  sample: { lat: number; lng: number; accuracy?: number; speed?: number }
): Promise<{ executionId: string; stopId: string; clientName: string } | null> {
  const execution = await RouteExecution.findOne({ _id: executionId, companyId })
    .populate('stops.clientId', 'name location')
    .exec();

  if (!execution || !['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(execution.status)) {
    return null;
  }

  const eligibleStop = findGeofenceEligibleStop(execution.stops);
  if (!eligibleStop) return null;

  const { trigger, distanceMeters } = shouldTriggerGeofenceArrival(eligibleStop, sample);
  if (!trigger) return null;

  const targetLat = eligibleStop.location.lat;
  const targetLng = eligibleStop.location.lng;

  eligibleStop.status = 'ARRIVED';
  eligibleStop.arrivedAt = new Date();
  eligibleStop.arrivalLocation = { lat: sample.lat, lng: sample.lng };
  eligibleStop.arrivalDistanceMeters = distanceMeters;

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
    stopId: eligibleStop._id,
    action: 'STOP_ARRIVED',
    driverId: execution.driverId,
    clientEventId: `geofence:${execution._id}:${eligibleStop._id}:${eligibleStop.arrivedAt.toISOString()}`,
    occurredAt: eligibleStop.arrivedAt,
    serverReceivedAt: new Date(),
    source: 'geofence',
    gps: {
      lat: sample.lat,
      lng: sample.lng,
      accuracy: sample.accuracy,
      recordedAt: eligibleStop.arrivedAt,
    },
    expectedLocation: {
      lat: targetLat,
      lng: targetLng,
    },
    distanceMeters: eligibleStop.arrivalDistanceMeters,
  });
  touchDashboard(companyId);

  const client = await Client.findById(eligibleStop.clientId).select('name').lean();

  return {
    executionId: execution._id.toString(),
    stopId: eligibleStop._id.toString(),
    clientName: client?.name ?? 'Unknown',
  };
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
