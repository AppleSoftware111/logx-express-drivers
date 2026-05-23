import mongoose, { Document, Schema, Types } from 'mongoose';

import type { AlertType } from '@logx/shared';

export interface IAlert extends Document {
  companyId: Types.ObjectId;
  executionId?: Types.ObjectId;
  type: AlertType;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    executionId: { type: Schema.Types.ObjectId, ref: 'RouteExecution' },
    type: {
      type: String,
      enum: ['DELAY_15', 'DELAY_30', 'DELAY_60', 'GEOFENCE', 'DRIVER_OFFLINE'],
      required: true,
    },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    strict: true,
  }
);

alertSchema.index({ companyId: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ executionId: 1, type: 1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
