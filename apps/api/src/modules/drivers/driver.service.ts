import type { CreateDriverInput, UpdateDriverInput } from '@logx/shared';
import { UserRole } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Driver } from '../../models/Driver.model';
import { User } from '../../models/User.model';
import { hashPassword } from '../auth/auth.service';

export async function listDrivers(companyId: string, onlineOnly = false) {
  const filter: Record<string, unknown> = { companyId, isActive: true };
  if (onlineOnly) filter.isOnline = true;

  return Driver.find(filter)
    .select('-__v')
    .populate('vehicleId', 'plate model type')
    .lean()
    .sort({ name: 1 });
}

export async function getDriver(companyId: string, driverId: string) {
  const driver = await Driver.findOne({ companyId, _id: driverId })
    .select('-__v')
    .populate('vehicleId', 'plate model type year')
    .lean();
  if (!driver) throw new AppError('Driver not found', 404);
  return driver;
}

export async function createDriver(companyId: string, data: CreateDriverInput) {
  let userId: string | undefined;

  if (data.createUserAccount) {
    if (!data.email || !data.password) {
      throw new AppError('Email and password required to create user account', 400);
    }

    const existing = await User.findOne({ email: data.email.toLowerCase() }).lean();
    if (existing) throw new AppError('Email already in use', 409);

    const user = await User.create({
      companyId,
      email: data.email.toLowerCase(),
      passwordHash: await hashPassword(data.password),
      role: UserRole.DRIVER,
    });
    userId = user._id.toString();
  }

  const driver = await Driver.create({
    companyId,
    name: data.name,
    phone: data.phone,
    cpf: data.cpf,
    licenseNumber: data.licenseNumber,
    vehicleId: data.vehicleId,
    userId,
  });

  if (userId) {
    await User.findByIdAndUpdate(userId, { driverId: driver._id });
  }

  return driver.toObject();
}

export async function updateDriver(
  companyId: string,
  driverId: string,
  data: UpdateDriverInput
) {
  const driver = await Driver.findOneAndUpdate(
    { companyId, _id: driverId },
    { $set: data },
    { new: true }
  ).lean();
  if (!driver) throw new AppError('Driver not found', 404);
  return driver;
}

export async function toggleDriverOnline(
  companyId: string,
  driverId: string,
  isOnline: boolean
) {
  const driver = await Driver.findOneAndUpdate(
    { companyId, _id: driverId },
    { $set: { isOnline } },
    { new: true }
  ).lean();
  if (!driver) throw new AppError('Driver not found', 404);
  return driver;
}

export async function deactivateDriver(companyId: string, driverId: string) {
  const driver = await Driver.findOneAndUpdate(
    { companyId, _id: driverId },
    { isActive: false, isOnline: false },
    { new: true }
  ).lean();
  if (!driver) throw new AppError('Driver not found', 404);
  return driver;
}
