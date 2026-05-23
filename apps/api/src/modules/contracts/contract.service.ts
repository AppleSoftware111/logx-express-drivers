import type { CreateContractInput, UpdateContractInput } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Contract } from '../../models/Contract.model';

export async function listContracts(companyId: string, clientId?: string) {
  const filter: Record<string, unknown> = { companyId };
  if (clientId) filter.clientId = clientId;

  return Contract.find(filter)
    .select('-__v')
    .populate('clientId', 'name type address')
    .lean()
    .sort({ startDate: -1 });
}

export async function getContract(companyId: string, contractId: string) {
  const contract = await Contract.findOne({ companyId, _id: contractId })
    .select('-__v')
    .populate('clientId', 'name type address')
    .lean();
  if (!contract) throw new AppError('Contract not found', 404);
  return contract;
}

export async function createContract(companyId: string, data: CreateContractInput) {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  if (end <= start) {
    throw new AppError('End date must be after start date', 400);
  }

  const contract = await Contract.create({
    companyId,
    clientId: data.clientId,
    startDate: start,
    endDate: end,
    slaMinutes: data.slaMinutes ?? 30,
  });
  return contract.toObject();
}

export async function updateContract(
  companyId: string,
  contractId: string,
  data: UpdateContractInput
) {
  const update: Record<string, unknown> = {};
  if (data.startDate) update.startDate = new Date(data.startDate);
  if (data.endDate) update.endDate = new Date(data.endDate);
  if (data.slaMinutes !== undefined) update.slaMinutes = data.slaMinutes;
  if (data.clientId) update.clientId = data.clientId;

  const contract = await Contract.findOneAndUpdate(
    { companyId, _id: contractId },
    { $set: update },
    { new: true }
  ).lean();
  if (!contract) throw new AppError('Contract not found', 404);
  return contract;
}

export async function deactivateContract(companyId: string, contractId: string) {
  const contract = await Contract.findOneAndUpdate(
    { companyId, _id: contractId },
    { isActive: false },
    { new: true }
  ).lean();
  if (!contract) throw new AppError('Contract not found', 404);
  return contract;
}
