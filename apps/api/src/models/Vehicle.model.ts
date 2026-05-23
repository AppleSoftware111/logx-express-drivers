import mongoose, { Schema, Types } from 'mongoose';

import type { VehicleType } from '@logx/shared';

export interface IVehicle {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  plate: string;
  model: string;
  year: number;
  type: VehicleType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    plate: { type: String, required: true, unique: true, uppercase: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    type: {
      type: String,
      enum: ['CAR', 'MOTORCYCLE', 'VAN', 'TRUCK'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

vehicleSchema.index({ plate: 1 }, { unique: true });
vehicleSchema.index({ companyId: 1 });

export const Vehicle = mongoose.model<IVehicle>('Vehicle', vehicleSchema);
