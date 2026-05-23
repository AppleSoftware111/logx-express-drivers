import mongoose, { Document, Schema, Types } from 'mongoose';

import { GPS_TTL_DAYS } from '@logx/shared';

export interface IGpsPoint extends Document {
  executionId: Types.ObjectId;
  driverId: Types.ObjectId;
  companyId: Types.ObjectId;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: Date;
}

const gpsPointSchema = new Schema<IGpsPoint>(
  {
    executionId: { type: Schema.Types.ObjectId, ref: 'RouteExecution', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    speed: { type: Number, min: 0 },
    heading: { type: Number, min: 0, max: 360 },
    accuracy: { type: Number, min: 0 },
    recordedAt: { type: Date, required: true },
  },
  {
    timestamps: false,
    strict: true,
  }
);

gpsPointSchema.index({ location: '2dsphere' });
gpsPointSchema.index({ executionId: 1, recordedAt: 1 });
gpsPointSchema.index({ driverId: 1, recordedAt: -1 });
// TTL index: auto-delete GPS points older than 90 days
gpsPointSchema.index(
  { recordedAt: 1 },
  { expireAfterSeconds: GPS_TTL_DAYS * 24 * 60 * 60 }
);

export const GpsPoint = mongoose.model<IGpsPoint>('GpsPoint', gpsPointSchema);
