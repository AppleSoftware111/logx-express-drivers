import mongoose, { Document, Schema, Types } from 'mongoose';

import type { RecurrenceType, RouteStopType } from '@logx/shared';

export interface IRouteStop {
  clientId: Types.ObjectId;
  order: number;
  address: string;
  location: { lat: number; lng: number };
  expectedDurationMinutes: number;
  type: RouteStopType;
}

export interface IRoute extends Document {
  companyId: Types.ObjectId;
  contractId?: Types.ObjectId;
  name: string;
  description?: string;
  recurrenceType: RecurrenceType;
  daysOfWeek: number[];
  scheduledTime: string;
  isActive: boolean;
  isTemplate: boolean;
  defaultDriverId?: Types.ObjectId;
  stops: IRouteStop[];
  createdAt: Date;
  updatedAt: Date;
}

const routeStopSchema = new Schema<IRouteStop>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    order: { type: Number, required: true },
    address: { type: String, required: true, trim: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    expectedDurationMinutes: { type: Number, default: 15 },
    type: { type: String, enum: ['PICKUP', 'DELIVERY', 'BOTH'], required: true },
  },
  { _id: false }
);

const routeSchema = new Schema<IRoute>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    recurrenceType: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
      required: true,
    },
    daysOfWeek: { type: [Number], default: [] },
    scheduledTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    isActive: { type: Boolean, default: true },
    isTemplate: { type: Boolean, default: false },
    defaultDriverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    stops: { type: [routeStopSchema], default: [] },
  },
  {
    timestamps: true,
    strict: true,
  }
);

routeSchema.index({ companyId: 1, isActive: 1, recurrenceType: 1 });
routeSchema.index({ companyId: 1, defaultDriverId: 1 });

export const Route = mongoose.model<IRoute>('Route', routeSchema);
