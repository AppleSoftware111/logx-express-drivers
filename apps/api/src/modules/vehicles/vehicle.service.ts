import type { CreateVehicleInput, UpdateVehicleInput } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Vehicle } from '../../models/Vehicle.model';

export async function listVehicles(companyId: string) {
  return Vehicle.find({ companyId, isActive: true }).select('-__v').lean().sort({ plate: 1 });
}

export async function getVehicle(companyId: string, vehicleId: string) {
  const vehicle = await Vehicle.findOne({ companyId, _id: vehicleId }).select('-__v').lean();
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  return vehicle;
}

export async function createVehicle(companyId: string, data: CreateVehicleInput) {
  const existing = await Vehicle.findOne({ plate: data.plate.toUpperCase() }).lean();
  if (existing) throw new AppError('A vehicle with this plate already exists', 409);

  const vehicle = await Vehicle.create({ companyId, ...data, plate: data.plate.toUpperCase() });
  return vehicle.toObject();
}

export async function updateVehicle(
  companyId: string,
  vehicleId: string,
  data: UpdateVehicleInput
) {
  if (data.plate) {
    const existing = await Vehicle.findOne({
      plate: data.plate.toUpperCase(),
      _id: { $ne: vehicleId },
    }).lean();
    if (existing) throw new AppError('Plate already in use', 409);
  }

  const vehicle = await Vehicle.findOneAndUpdate(
    { companyId, _id: vehicleId },
    { $set: data },
    { new: true }
  ).lean();
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  return vehicle;
}

export async function deactivateVehicle(companyId: string, vehicleId: string) {
  const vehicle = await Vehicle.findOneAndUpdate(
    { companyId, _id: vehicleId },
    { isActive: false },
    { new: true }
  ).lean();
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  return vehicle;
}
