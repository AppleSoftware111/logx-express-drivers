import mongoose, { Document, Schema, Types } from 'mongoose';

import type { ClientType } from '@logx/shared';

export interface IClient extends Document {
  companyId: Types.ObjectId;
  name: string;
  cnpj?: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  type: ClientType;
  userId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    cnpj: { type: String, sparse: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    type: {
      type: String,
      enum: ['HOSPITAL', 'LABORATORY', 'OTHER'],
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

clientSchema.index({ location: '2dsphere' });
clientSchema.index({ companyId: 1 });
clientSchema.index({ companyId: 1, type: 1 });

export const Client = mongoose.model<IClient>('Client', clientSchema);
