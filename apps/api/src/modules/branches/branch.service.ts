import type { CreateBranchInput } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Branch } from '../../models/Branch.model';

export async function listBranches(companyId: string) {
  return Branch.find({ companyId }).select('-__v').lean().sort({ name: 1 });
}

export async function getBranch(companyId: string, branchId: string) {
  const branch = await Branch.findOne({ companyId, _id: branchId }).select('-__v').lean();
  if (!branch) throw new AppError('Branch not found', 404);
  return branch;
}

export async function createBranch(companyId: string, data: CreateBranchInput) {
  const branch = await Branch.create({
    companyId,
    name: data.name,
    address: data.address,
    location: { type: 'Point', coordinates: [data.lng, data.lat] },
  });
  return branch.toObject();
}

export async function updateBranch(
  companyId: string,
  branchId: string,
  data: Partial<CreateBranchInput>
) {
  const update: Record<string, unknown> = {};
  if (data.name) update.name = data.name;
  if (data.address) update.address = data.address;
  if (data.lat !== undefined && data.lng !== undefined) {
    update.location = { type: 'Point', coordinates: [data.lng, data.lat] };
  }

  const branch = await Branch.findOneAndUpdate({ companyId, _id: branchId }, update, {
    new: true,
  }).lean();
  if (!branch) throw new AppError('Branch not found', 404);
  return branch;
}

export async function deleteBranch(companyId: string, branchId: string) {
  const branch = await Branch.findOneAndUpdate(
    { companyId, _id: branchId },
    { isActive: false },
    { new: true }
  ).lean();
  if (!branch) throw new AppError('Branch not found', 404);
  return branch;
}
