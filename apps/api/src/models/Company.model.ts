import mongoose, { Document, Schema } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  cnpj?: string;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    cnpj: { type: String, unique: true, sparse: true, trim: true },
    logo: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

companySchema.index({ cnpj: 1 }, { unique: true, sparse: true });

export const Company = mongoose.model<ICompany>('Company', companySchema);
