import mongoose from 'mongoose';

import { env } from './env';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

export async function connectDB(): Promise<void> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5_000,
        socketTimeoutMS: 45_000,
      });

      console.info('[db] MongoDB connected successfully');

      mongoose.connection.on('disconnected', () => {
        console.warn('[db] MongoDB disconnected — attempting reconnect');
        void reconnect();
      });

      mongoose.connection.on('error', (err: Error) => {
        console.error('[db] MongoDB error:', err.message);
      });

      return;
    } catch (err) {
      attempt++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${message}`);

      if (attempt < MAX_RETRIES) {
        console.info(`[db] Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error('[db] All connection attempts failed. Exiting.');
        process.exit(1);
      }
    }
  }
}

async function reconnect(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.info('[db] MongoDB reconnected');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db] Reconnect failed:', message);
    setTimeout(() => void reconnect(), RETRY_DELAY_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.info('[db] MongoDB disconnected gracefully');
}
