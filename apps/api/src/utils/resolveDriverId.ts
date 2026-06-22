import { Driver } from '../models/Driver.model';
import { User } from '../models/User.model';

type UserLike = {
  _id: { toString(): string };
  role: string;
  driverId?: { toString(): string } | null;
};

/**
 * Returns the driver's Mongo id for tracking uploads.
 * Falls back to Driver.userId when User.driverId was never synced.
 */
export async function resolveDriverIdForUser(
  user: UserLike,
  driverIdFromToken?: string
): Promise<string | undefined> {
  if (driverIdFromToken) {
    return driverIdFromToken;
  }

  if (user.role !== 'DRIVER') {
    return undefined;
  }

  if (user.driverId) {
    return user.driverId.toString();
  }

  const userId = user._id.toString();
  const driver = await Driver.findOne({ userId: user._id }).select('_id').lean();
  if (!driver?._id) {
    return undefined;
  }

  const resolvedId = driver._id.toString();
  await User.findByIdAndUpdate(userId, { $set: { driverId: driver._id } });
  return resolvedId;
}

export async function resolveDriverIdByUserId(
  userId: string,
  role: string,
  driverIdFromToken?: string
): Promise<string | undefined> {
  if (driverIdFromToken) {
    return driverIdFromToken;
  }

  if (role !== 'DRIVER') {
    return undefined;
  }

  const user = await User.findById(userId).select('role driverId').lean();
  if (!user) {
    return undefined;
  }

  return resolveDriverIdForUser(user, undefined);
}
