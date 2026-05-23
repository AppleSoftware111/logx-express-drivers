import IORedis from 'ioredis';

import { env } from './env';

let redisClient: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!redisClient) {
    throw new Error('[redis] Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisClient?.status === 'ready';
}

export async function initRedis(): Promise<IORedis | null> {
  const client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 5_000,
    retryStrategy: () => null,
  });

  client.on('connect', () => {
    console.info('[redis] Connected successfully');
  });

  client.on('error', (err: Error) => {
    console.error('[redis] Error:', err.message);
  });

  try {
    await client.connect();
    redisClient = client;
    return client;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await client.quit().catch(() => undefined);

    if (env.NODE_ENV === 'development') {
      console.warn(
        `[redis] Unavailable (${msg}) — continuing without cache. Start Redis on ${env.REDIS_URL} for full features.`
      );
      return null;
    }

    throw err;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.info('[redis] Disconnected gracefully');
  }
}
