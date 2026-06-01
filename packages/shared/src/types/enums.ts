export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  CLIENT = 'CLIENT',
  DRIVER = 'DRIVER',
}

export enum VehicleType {
  CAR = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
  VAN = 'VAN',
  TRUCK = 'TRUCK',
}

export enum ClientType {
  HOSPITAL = 'HOSPITAL',
  LABORATORY = 'LABORATORY',
  OTHER = 'OTHER',
}

export enum RecurrenceType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum RouteStopType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  BOTH = 'BOTH',
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum StopStatus {
  PENDING = 'PENDING',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export enum AlertType {
  DELAY_15 = 'DELAY_15',
  DELAY_30 = 'DELAY_30',
  DELAY_60 = 'DELAY_60',
  GEOFENCE = 'GEOFENCE',
  DRIVER_OFFLINE = 'DRIVER_OFFLINE',
}

export enum WhatsAppProvider {
  ZAPI = 'zapi',
  TWILIO = 'twilio',
}
