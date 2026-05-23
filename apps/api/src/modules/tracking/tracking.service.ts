import type { GpsPointInput } from '@logx/shared';
import { GEOFENCE_RADIUS_METERS } from '@logx/shared';

import { Client } from '../../models/Client.model';
import { Driver } from '../../models/Driver.model';
import { GpsPoint } from '../../models/GpsPoint.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import { isWithinRadius } from '../../utils/haversine';

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
    if (stop.status !== 'PENDING') continue;

    const targetLat = stop.location.lat;
    const targetLng = stop.location.lng;

    if (isWithinRadius(lat, lng, targetLat, targetLng, GEOFENCE_RADIUS_METERS)) {
      stop.status = 'ARRIVED';
      stop.arrivedAt = new Date();

      // Auto-progress execution to IN_PROGRESS on first arrival
      if (execution.status === 'ASSIGNED' || execution.status === 'ACCEPTED') {
        execution.status = 'IN_PROGRESS';
        if (!execution.actualStartTime) {
          execution.actualStartTime = new Date();
        }
      }

      await execution.save();

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
  return Driver.find({ companyId, isOnline: true, isActive: true })
    .select('name currentLocation vehicleId')
    .populate('vehicleId', 'plate type')
    .lean();
}
