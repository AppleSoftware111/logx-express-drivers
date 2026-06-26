/**
 * Adds runSeq=1 to existing RouteExecution documents and rebuilds the unique index.
 *
 * Usage (from apps/api):
 *   npx ts-node --transpile-only src/scripts/migrate-execution-run-seq.ts
 */
import mongoose from 'mongoose';

import { env } from '../config/env';
import { RouteExecution } from '../models/RouteExecution.model';

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.log('[migrate-execution-run-seq] Connected to MongoDB');

  const collection = RouteExecution.collection;

  const withoutRunSeq = await collection.updateMany(
    { runSeq: { $exists: false } },
    { $set: { runSeq: 1 } }
  );
  console.log(`[migrate-execution-run-seq] Backfilled runSeq on ${withoutRunSeq.modifiedCount} documents`);

  try {
    await collection.dropIndex('routeId_1_scheduledDate_1');
    console.log('[migrate-execution-run-seq] Dropped old routeId+scheduledDate unique index');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('index not found') && !message.includes('ns not found')) {
      console.warn('[migrate-execution-run-seq] Could not drop old index:', message);
    }
  }

  await RouteExecution.syncIndexes();
  console.log('[migrate-execution-run-seq] Synced indexes (routeId+scheduledDate+runSeq unique)');

  await mongoose.disconnect();
}

void main().catch((error: unknown) => {
  console.error('[migrate-execution-run-seq] Failed:', error);
  process.exit(1);
});
