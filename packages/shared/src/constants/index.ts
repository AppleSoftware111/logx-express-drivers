export const GEOFENCE_RADIUS_METERS = 100;

export const GPS_BUFFER_FLUSH_INTERVAL_MS = 30_000;

export const GPS_EMIT_INTERVAL_MS = 5_000;
export const GPS_PRESENCE_INTERVAL_MS = 30_000;

export const GPS_TTL_DAYS = 90;

export const DRIVER_LOCATION_LIVE_WINDOW_MS = 45_000;
export const DRIVER_LOCATION_RECENT_WINDOW_MS = 3 * 60_000;
export const DRIVER_LOCATION_STALE_WINDOW_MS = 10 * 60_000;

export const DELAY_THRESHOLDS_MINUTES = [15, 30, 60] as const;

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const JWT_ACCESS_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '7d';
export const BCRYPT_ROUNDS = 12;

export const S3_PRESIGNED_URL_EXPIRES_SECONDS = 3600;

export const POD_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const POD_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const SOCKET_ROOMS = {
  adminRoom: (companyId: string) => `admin:${companyId}`,
  companyRoom: (companyId: string) => `company:${companyId}`,
  driverRoom: (driverId: string) => `driver:${driverId}`,
  clientRoom: (clientId: string) => `client:${clientId}`,
  executionRoom: (executionId: string) => `execution:${executionId}`,
} as const;

export const SOCKET_EVENTS = {
  // Driver → Server
  DRIVER_LOCATION: 'driver:location',
  DRIVER_PRESENCE_LOCATION: 'driver:presence_location',
  DRIVER_ONLINE: 'driver:online',
  DRIVER_OFFLINE: 'driver:offline',
  // Server → Admin
  ADMIN_DRIVER_LOCATION: 'admin:driver_location',
  ADMIN_ALERT: 'admin:alert',
  ADMIN_EXECUTION_UPDATE: 'admin:execution_update',
  // Server → Driver
  DRIVER_ROUTE_ASSIGNED: 'driver:route_assigned',
  DRIVER_ROUTE_UPDATED: 'driver:route_updated',
  DRIVER_ROUTE_CANCELLED: 'driver:route_cancelled',
  DRIVER_ARRIVED_CONFIRMED: 'driver:arrived_confirmed',
  // Server → Client
  CLIENT_DELIVERY_UPDATE: 'client:delivery_update',
} as const;
