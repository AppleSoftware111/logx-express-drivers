const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Returns the distance in meters between two lat/lng coordinates
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Returns true if the driver is within `radiusMeters` of the target location.
 */
export function isWithinRadius(
  driverLat: number,
  driverLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number
): boolean {
  return haversineDistance(driverLat, driverLng, targetLat, targetLng) <= radiusMeters;
}
