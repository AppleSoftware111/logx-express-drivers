import { Driver } from '../models/Driver.model';
import { User } from '../models/User.model';

type UserLike = {
  _id: { toString(): string };
  role: string;
  driverId?: { toString(): string } | null;
};

async function syncUserDriverId(userId: string, driverObjectId: unknown): Promise<void> {
  await User.findByIdAndUpdate(userId, { $set: { driverId: driverObjectId } });
}

/**
 * Returns the driver's Mongo id for tracking uploads.
 * Validates JWT claims, then falls back to User.driverId and Driver.userId.
 */
export async function resolveDriverIdForUser(
  user: UserLike,
  driverIdFromToken?: string
): Promise<string | undefined> {
  if (user.role !== 'DRIVER') {
    return undefined;
  }

  const userId = user._id.toString();

  if (driverIdFromToken) {
    const linkedDriver = await Driver.findOne({ _id: driverIdFromToken, userId: user._id })
      .select('_id')
      .lean();
    if (linkedDriver?._id) {
      if (!user.driverId) {
        await syncUserDriverId(userId, linkedDriver._id);
      }
      return linkedDriver._id.toString();
    }
  }

  if (user.driverId) {
    const linkedDriver = await Driver.findOne({ _id: user.driverId, userId: user._id })
      .select('_id')
      .lean();
    if (linkedDriver?._id) {
      return linkedDriver._id.toString();
    }
  }

  const driver = await Driver.findOne({ userId: user._id }).select('_id').lean();
  if (!driver?._id) {
    return undefined;
  }

  const resolvedId = driver._id.toString();
  await syncUserDriverId(userId, driver._id);
  return resolvedId;
}

export async function resolveDriverIdByUserId(
  userId: string,
  role: string,
  driverIdFromToken?: string
): Promise<string | undefined> {
  if (role !== 'DRIVER') {
    return undefined;
  }

  const user = await User.findById(userId).select('role driverId').lean();
  if (!user) {
    return undefined;
  }

  return resolveDriverIdForUser(user, driverIdFromToken);
}
