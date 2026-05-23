import type { CreateCompanyInput, UpdateCompanyInput } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Company } from '../../models/Company.model';

export async function listCompanies(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [companies, total] = await Promise.all([
    Company.find().select('-__v').lean().skip(skip).limit(limit).sort({ createdAt: -1 }),
    Company.countDocuments(),
  ]);
  return { companies, total };
}

export async function getCompany(companyId: string) {
  const company = await Company.findById(companyId).select('-__v').lean();
  if (!company) throw new AppError('Company not found', 404);
  return company;
}

export async function createCompany(data: CreateCompanyInput) {
  if (data.cnpj) {
    const existing = await Company.findOne({ cnpj: data.cnpj }).lean();
    if (existing) throw new AppError('A company with this CNPJ already exists', 409);
  }

  const company = await Company.create(data);
  return company.toObject();
}

export async function updateCompany(companyId: string, data: UpdateCompanyInput) {
  if (data.cnpj) {
    const existing = await Company.findOne({ cnpj: data.cnpj, _id: { $ne: companyId } }).lean();
    if (existing) throw new AppError('CNPJ already in use', 409);
  }

  const company = await Company.findByIdAndUpdate(companyId, data, { new: true }).lean();
  if (!company) throw new AppError('Company not found', 404);
  return company;
}

export async function deactivateCompany(companyId: string) {
  const company = await Company.findByIdAndUpdate(
    companyId,
    { isActive: false },
    { new: true }
  ).lean();
  if (!company) throw new AppError('Company not found', 404);
  return company;
}
