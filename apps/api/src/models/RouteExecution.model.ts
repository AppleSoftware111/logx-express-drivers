import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IExecutionStop {
  _id: Types.ObjectId;
  routeStopIndex: number;
  clientId: Types.ObjectId;
  order: number;
  address: string;
  location: { lat: number; lng: number };
  plannedTime: string;
  expectedDurationMinutes: number;
  type: string;
  status: string;
  onTheWayAt?: Date;
  arrivedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  waitingTimeMinutes?: number;
  podPhoto?: string;
  podSignature?: string;
  receiverName?: string;
  deliveryNotes?: string;
  deliveryLocation?: { lat: number; lng: number };
  arrivalLocation?: { lat: number; lng: number };
  arrivalAddress?: string;
  arrivalDistanceMeters?: number;
  collectionAddress?: string;
  collectionDistanceMeters?: number;
  instructions?: string;
}

export interface IRouteExecution extends Document {
  companyId: Types.ObjectId;
  routeId: Types.ObjectId;
  contractId?: Types.ObjectId;
  scheduledDate: Date;
  scheduledTime: string;
  driverId: Types.ObjectId;
  originalDriverId: Types.ObjectId;
  isSubstitution: boolean;
  status: string;
  actualStartTime?: Date;
  actualEndTime?: Date;
  totalDurationMinutes?: number;
  delayMinutes: number;
  stops: mongoose.Types.DocumentArray<IExecutionStop & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const executionStopSchema = new Schema<IExecutionStop>(
  {
    routeStopIndex: { type: Number, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    order: { type: Number, required: true },
    address: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    plannedTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    expectedDurationMinutes: { type: Number, default: 15 },
    type: { type: String, enum: ['PICKUP', 'DELIVERY', 'BOTH'], required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
      default: 'PENDING',
    },
    onTheWayAt: { type: Date },
    arrivedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    waitingTimeMinutes: { type: Number },
    podPhoto: { type: String },
    podSignature: { type: String },
    receiverName: { type: String },
    deliveryNotes: { type: String },
    instructions: { type: String },
    deliveryLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    arrivalLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    arrivalAddress: { type: String },
    arrivalDistanceMeters: { type: Number },
    collectionAddress: { type: String },
    collectionDistanceMeters: { type: Number },
  },
  { timestamps: false }
);

const routeExecutionSchema = new Schema<IRouteExecution>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    originalDriverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    isSubstitution: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    totalDurationMinutes: { type: Number },
    delayMinutes: { type: Number, default: 0 },
    stops: { type: [executionStopSchema], default: [] },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Compound unique index: prevents duplicate execution for the same route + date
routeExecutionSchema.index({ routeId: 1, scheduledDate: 1 }, { unique: true });
routeExecutionSchema.index({ companyId: 1, scheduledDate: 1 });
routeExecutionSchema.index({ driverId: 1, scheduledDate: 1 });
routeExecutionSchema.index({ status: 1 });
routeExecutionSchema.index({ companyId: 1, status: 1, scheduledDate: -1 });

export const RouteExecution = mongoose.model<IRouteExecution>(
  'RouteExecution',
  routeExecutionSchema
);
