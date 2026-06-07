import type { CreateDriverInput, UpdateDriverInput } from '@logx/shared';
import { UserRole } from '@logx/shared';

import { ApiErrorCode } from '@logx/i18n';

import { AppError } from '../../middleware/errorHandler';
import { Driver } from '../../models/Driver.model';
import { User } from '../../models/User.model';
import { hashPassword } from '../auth/auth.service';

export async function listDrivers(companyId: string, onlineOnly = false, isActive?: boolean) {
  const filter: Record<string, unknown> = { companyId, isActive: isActive ?? true };
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
  if (!driver) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);
  return driver;
}

export async function createDriver(companyId: string, data: CreateDriverInput) {
  let userId: string | undefined;

  if (data.createUserAccount) {
    if (!data.email || !data.password) {
      throw new AppError(ApiErrorCode.DRIVER_EMAIL_PASSWORD_REQUIRED, 400);
    }

    const existing = await User.findOne({ email: data.email.toLowerCase() }).lean();
    if (existing) throw new AppError(ApiErrorCode.EMAIL_ALREADY_IN_USE, 409);

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
  const { email, password, ...driverUpdates } = data as UpdateDriverInput & {
    email?: string;
    password?: string;
  };

  const normalizedEmail = email?.trim().toLowerCase();
  const rawPassword = password?.trim();

  const driver = await Driver.findOne({ companyId, _id: driverId });
  if (!driver) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);

  const shouldUpdateCredentials = Boolean(normalizedEmail || rawPassword);

  if (shouldUpdateCredentials) {
    let user =
      driver.userId != null ? await User.findById(driver.userId).select('+passwordHash') : null;

    if (!user) {
      if (!normalizedEmail || !rawPassword) {
        throw new AppError(ApiErrorCode.DRIVER_EMAIL_PASSWORD_REQUIRED, 400);
      }

      const existing = await User.findOne({ email: normalizedEmail }).lean();
      if (existing) throw new AppError(ApiErrorCode.EMAIL_ALREADY_IN_USE, 409);

      user = await User.create({
        companyId,
        driverId: driver._id,
        email: normalizedEmail,
        passwordHash: await hashPassword(rawPassword),
        role: UserRole.DRIVER,
      });

      driver.userId = user._id;
    } else {
      if (normalizedEmail && normalizedEmail !== user.email) {
        const existing = await User.findOne({ email: normalizedEmail }).lean();
        if (existing && existing._id.toString() !== user._id.toString()) {
          throw new AppError(ApiErrorCode.EMAIL_ALREADY_IN_USE, 409);
        }
        user.email = normalizedEmail;
      }

      if (rawPassword) {
        user.passwordHash = await hashPassword(rawPassword);
      }

      await user.save();
    }
  }

  Object.entries(driverUpdates).forEach(([key, value]) => {
    if (value !== undefined) {
      (driver as unknown as Record<string, unknown>)[key] = value;
    }
  });

  await driver.save();

  const updated = await Driver.findById(driver._id)
    .select('-__v')
    .populate('vehicleId', 'plate model type')
    .lean();

  if (!updated) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);
  return updated;
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
  if (!driver) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);
  return driver;
}

export async function deactivateDriver(companyId: string, driverId: string) {
  const driver = await Driver.findOneAndUpdate(
    { companyId, _id: driverId },
    { isActive: false, isOnline: false },
    { new: true }
  ).lean();
  if (!driver) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);
  return driver;
}

export async function toggleDriverActive(
  companyId: string,
  driverId: string,
  isActive: boolean
) {
  const driver = await Driver.findOneAndUpdate(
    { companyId, _id: driverId },
    { isActive, ...(isActive ? {} : { isOnline: false }) },
    { new: true }
  ).lean();
  if (!driver) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);
  return driver;
}
