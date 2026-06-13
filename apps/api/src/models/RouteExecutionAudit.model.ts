import mongoose, { Document, Schema, Types } from 'mongoose';

export type RouteExecutionAuditAction =
  | 'ROUTE_RECEIVED'
  | 'STOP_ON_THE_WAY'
  | 'STOP_ARRIVED'
  | 'STOP_COLLECTED'
  | 'ROUTE_COMPLETED'
  | 'STOP_SKIPPED';

export interface IRouteExecutionAudit extends Document {
  companyId: Types.ObjectId;
  routeId: Types.ObjectId;
  executionId: Types.ObjectId;
  stopId?: Types.ObjectId;
  action: RouteExecutionAuditAction;
  actorUserId?: Types.ObjectId;
  driverId: Types.ObjectId;
  clientEventId: string;
  occurredAt: Date;
  serverReceivedAt: Date;
  syncedAt?: Date;
  source: 'mobile_online' | 'mobile_offline_sync' | 'geofence' | 'admin';
  gps?: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    recordedAt?: Date;
  };
  expectedLocation?: {
    lat: number;
    lng: number;
  };
  distanceMeters?: number;
  resolvedAddress?: string;
  notes?: string;
  receiverName?: string;
  photoKey?: string;
  signatureKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const gpsSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speed: { type: Number },
    heading: { type: Number },
    accuracy: { type: Number },
    recordedAt: { type: Date },
  },
  { _id: false }
);

const expectedLocationSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const routeExecutionAuditSchema = new Schema<IRouteExecutionAudit>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    executionId: { type: Schema.Types.ObjectId, ref: 'RouteExecution', required: true, index: true },
    stopId: { type: Schema.Types.ObjectId },
    action: {
      type: String,
      enum: [
        'ROUTE_RECEIVED',
        'STOP_ON_THE_WAY',
        'STOP_ARRIVED',
        'STOP_COLLECTED',
        'ROUTE_COMPLETED',
        'STOP_SKIPPED',
      ],
      required: true,
      index: true,
    },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    clientEventId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    serverReceivedAt: { type: Date, default: Date.now },
    syncedAt: { type: Date },
    source: {
      type: String,
      enum: ['mobile_online', 'mobile_offline_sync', 'geofence', 'admin'],
      required: true,
    },
    gps: { type: gpsSchema },
    expectedLocation: { type: expectedLocationSchema },
    distanceMeters: { type: Number },
    resolvedAddress: { type: String },
    notes: { type: String },
    receiverName: { type: String },
    photoKey: { type: String },
    signatureKey: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

routeExecutionAuditSchema.index({ companyId: 1, clientEventId: 1 }, { unique: true });
routeExecutionAuditSchema.index({ executionId: 1, occurredAt: 1 });
routeExecutionAuditSchema.index({ executionId: 1, stopId: 1, action: 1 });

export const RouteExecutionAudit = mongoose.model<IRouteExecutionAudit>(
  'RouteExecutionAudit',
  routeExecutionAuditSchema
);
