/**
 * Repairs bidirectional User <-> Driver links for DRIVER accounts.
 *
 * Usage (from apps/api):
 *   npx ts-node --transpile-only src/scripts/repair-driver-links.ts
 */
import mongoose from 'mongoose';

import { env } from '../config/env';
import { Driver } from '../models/Driver.model';
import { User } from '../models/User.model';
import { resolveDriverIdForUser } from '../utils/resolveDriverId';

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.log('[repair-driver-links] Connected to MongoDB');

  const drivers = await User.find({ role: 'DRIVER', isActive: true }).select('email role driverId');
  let repaired = 0;
  let unresolved = 0;

  for (const user of drivers) {
    const before = user.driverId?.toString() ?? null;
    const resolved = await resolveDriverIdForUser(user);
    const driver = resolved
      ? await Driver.findById(resolved).select('userId name phone').lean()
      : null;

    if (!resolved || !driver) {
      unresolved += 1;
      console.warn(
        `[repair-driver-links] UNRESOLVED user=${user.email} driverIdBefore=${before ?? 'none'}`
      );
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (!before || before !== resolved) {
      updates.driverId = driver._id;
    }
    if (!driver.userId || driver.userId.toString() !== user._id.toString()) {
      await Driver.findByIdAndUpdate(driver._id, { $set: { userId: user._id } });
    }

    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(user._id, { $set: updates });
    }

    repaired += 1;
    console.log(
      `[repair-driver-links] OK user=${user.email} driver=${driver.name} driverId=${resolved}`
    );
  }

  console.log(
    `[repair-driver-links] Done. repaired=${repaired} unresolved=${unresolved} total=${drivers.length}`
  );
  await mongoose.disconnect();
}

void main().catch((error: unknown) => {
  console.error('[repair-driver-links] Failed:', error);
  process.exit(1);
});
