import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDriverLocation {
  lat: number;
  lng: number;
  updatedAt: Date;
}

export interface IDriver extends Document {
  companyId: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  phone?: string;
  cpf?: string;
  licenseNumber?: string;
  vehicleId?: Types.ObjectId;
  isActive: boolean;
  isOnline: boolean;
  currentLocation?: IDriverLocation;
  createdAt: Date;
  updatedAt: Date;
}

const driverLocationSchema = new Schema<IDriverLocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const driverSchema = new Schema<IDriver>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    cpf: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    currentLocation: { type: driverLocationSchema, default: null },
  },
  {
    timestamps: true,
    strict: true,
  }
);

driverSchema.index({ companyId: 1 });
driverSchema.index({ companyId: 1, isOnline: 1 });
driverSchema.index({ userId: 1 }, { sparse: true });

export const Driver = mongoose.model<IDriver>('Driver', driverSchema);
