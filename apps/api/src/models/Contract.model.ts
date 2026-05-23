import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IContract extends Document {
  companyId: Types.ObjectId;
  clientId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  slaMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contractSchema = new Schema<IContract>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    slaMinutes: { type: Number, default: 30, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

contractSchema.index({ companyId: 1, clientId: 1 });
contractSchema.index({ companyId: 1, isActive: 1 });

export const Contract = mongoose.model<IContract>('Contract', contractSchema);
