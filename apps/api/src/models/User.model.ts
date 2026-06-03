import mongoose, { Document, Schema, Types } from 'mongoose';

import type { SupportedLocale } from '@logx/i18n';
import type { UserRole } from '@logx/shared';

export interface IRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface IUser extends Document {
  companyId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  locale: SupportedLocale;
  localeUpdatedAt?: Date | null;
  refreshTokens: IRefreshToken[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'CLIENT', 'DRIVER'],
      required: true,
    },
    locale: {
      type: String,
      enum: ['pt', 'es', 'en'],
      default: 'pt',
    },
    localeUpdatedAt: { type: Date, default: null },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ companyId: 1, role: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
