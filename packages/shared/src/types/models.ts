import type { AlertType, ExecutionStatus, RecurrenceType, RouteStopType, StopStatus, UserRole, VehicleType, ClientType } from './enums';

export interface BaseModel {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDto extends BaseModel {
  name: string;
  cnpj?: string;
  logo?: string;
  isActive: boolean;
}

export interface BranchDto extends BaseModel {
  companyId: string;
  name: string;
  address: string;
  location: { type: 'Point'; coordinates: [number, number] };
  isActive: boolean;
}

export interface UserDto extends BaseModel {
  companyId?: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  driverId?: string;
  clientId?: string;
}

export interface DriverDto extends BaseModel {
  companyId: string;
  userId?: string;
  name: string;
  phone?: string;
  cpf?: string;
  licenseNumber?: string;
  vehicleId?: VehicleDto | string;
  isActive: boolean;
  isOnline: boolean;
  currentLocation?: { lat: number; lng: number; updatedAt: string };
}

export interface VehicleDto extends BaseModel {
  companyId: string;
  plate: string;
  model: string;
  year: number;
  type: VehicleType;
  isActive: boolean;
}

export interface ClientDto extends BaseModel {
  companyId: string;
  name: string;
  cnpj?: string;
  address: string;
  location: { type: 'Point'; coordinates: [number, number] };
  type: ClientType;
  userId?: UserDto | string;
  isActive: boolean;
}

export interface ContractDto extends BaseModel {
  companyId: string;
  clientId: ClientDto | string;
  startDate: string;
  endDate: string;
  slaMinutes: number;
  isActive: boolean;
}

export interface RouteStopDto {
  clientId: ClientDto | string;
  order: number;
  address: string;
  location: { lat: number; lng: number };
  expectedDurationMinutes: number;
  type: RouteStopType;
}

export interface RouteDto extends BaseModel {
  companyId: string;
  contractId?: ContractDto | string;
  name: string;
  description?: string;
  recurrenceType: RecurrenceType;
  daysOfWeek: number[];
  scheduledTime: string;
  isActive: boolean;
  isTemplate: boolean;
  defaultDriverId?: DriverDto | string;
  stops: RouteStopDto[];
}

export interface ExecutionStopDto {
  _id: string;
  routeStopIndex: number;
  clientId: ClientDto | string;
  order: number;
  address: string;
  location: { lat: number; lng: number };
  type: RouteStopType;
  status: StopStatus;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  waitingTimeMinutes?: number;
  podPhoto?: string;
  podSignature?: string;
  receiverName?: string;
  deliveryNotes?: string;
  deliveryLocation?: { lat: number; lng: number };
}

export interface RouteExecutionDto extends BaseModel {
  companyId: string;
  routeId: RouteDto | string;
  scheduledDate: string;
  scheduledTime: string;
  driverId: DriverDto | string;
  originalDriverId: DriverDto | string;
  isSubstitution: boolean;
  status: ExecutionStatus;
  actualStartTime?: string;
  actualEndTime?: string;
  totalDurationMinutes?: number;
  delayMinutes: number;
  stops: ExecutionStopDto[];
}

export interface GpsPointDto {
  executionId: string;
  driverId: string;
  location: { type: 'Point'; coordinates: [number, number] };
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
}

export interface AlertDto extends BaseModel {
  companyId: string;
  executionId?: RouteExecutionDto | string;
  type: AlertType;
  message: string;
  isRead: boolean;
}
