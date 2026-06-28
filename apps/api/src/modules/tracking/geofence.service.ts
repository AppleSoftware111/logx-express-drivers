import {
  GEOFENCE_MAX_SPEED_MPS,
  GEOFENCE_MIN_ACCURACY_METERS,
  GEOFENCE_RADIUS_METERS,
} from '@logx/shared';

import { haversineDistance, isWithinRadius } from '../../utils/haversine';

export type GeofenceStopCandidate = {
  _id: unknown;
  order: number;
  status: string;
  location: { lat: number; lng: number };
};

export type GeofenceGpsSample = {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
};

export function isValidStopCoordinates(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

export function isGpsSampleAccurateEnough(accuracy?: number): boolean {
  if (accuracy == null || !Number.isFinite(accuracy)) return true;
  return accuracy <= GEOFENCE_MIN_ACCURACY_METERS;
}

export function isGpsSampleSlowEnough(speed?: number): boolean {
  if (speed == null || !Number.isFinite(speed) || speed < 0) return true;
  return speed <= GEOFENCE_MAX_SPEED_MPS;
}

/**
 * Only the active ON_THE_WAY stop may auto-arrive via geofence.
 * PENDING stops require the driver to tap "On the way" first.
 */
export function findGeofenceEligibleStop<T extends GeofenceStopCandidate>(
  stops: T[]
): T | null {
  const sorted = [...stops].sort((a, b) => a.order - b.order);
  return sorted.find((stop) => stop.status === 'ON_THE_WAY') ?? null;
}

export function shouldTriggerGeofenceArrival(
  stop: GeofenceStopCandidate,
  sample: GeofenceGpsSample,
  radiusMeters = GEOFENCE_RADIUS_METERS
): { trigger: boolean; distanceMeters?: number } {
  if (stop.status !== 'ON_THE_WAY') {
    return { trigger: false };
  }

  const targetLat = stop.location.lat;
  const targetLng = stop.location.lng;

  if (!isValidStopCoordinates(targetLat, targetLng)) {
    return { trigger: false };
  }

  if (!isGpsSampleAccurateEnough(sample.accuracy)) {
    return { trigger: false };
  }

  if (!isGpsSampleSlowEnough(sample.speed)) {
    return { trigger: false };
  }

  const distanceMeters = haversineDistance(sample.lat, sample.lng, targetLat, targetLng);
  if (!isWithinRadius(sample.lat, sample.lng, targetLat, targetLng, radiusMeters)) {
    return { trigger: false, distanceMeters };
  }

  return { trigger: true, distanceMeters: Math.round(distanceMeters) };
}
