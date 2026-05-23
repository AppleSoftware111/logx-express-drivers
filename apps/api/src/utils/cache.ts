import { getRedisClient } from '../config/redis';

/**
 * Simple Redis cache wrapper.
 * Falls back to the fetcher if Redis is unavailable so the app stays resilient.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const value = await fetcher();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  } catch {
    // Redis unavailable — fetch directly without caching
    return fetcher();
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-critical
  }
}

export function cacheKey(...parts: string[]): string {
  return parts.join(':');
}
