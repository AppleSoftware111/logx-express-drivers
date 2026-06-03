import { getRedisClient, isRedisAvailable } from '../config/redis';

export async function runWithJobLock(
  lockName: string,
  ttlMs: number,
  job: () => Promise<void>
): Promise<boolean> {
  if (!isRedisAvailable()) {
    await job();
    return true;
  }

  const redis = getRedisClient();
  const lockKey = `jobs:lock:${lockName}`;
  const lockValue = `${process.pid}:${Date.now()}`;
  const acquired = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

  if (acquired !== 'OK') {
    console.info(`[jobs] Skipping ${lockName}; another instance owns the lock`);
    return false;
  }

  try {
    await job();
    return true;
  } finally {
    const currentValue = await redis.get(lockKey);
    if (currentValue === lockValue) {
      await redis.del(lockKey);
    }
  }
}
