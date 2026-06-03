import cron from 'node-cron';

import { GpsPoint } from '../models/GpsPoint.model';
import { RouteExecution } from '../models/RouteExecution.model';
import { runWithJobLock } from './jobLock';

/**
 * Weekly cron that hard-deletes GPS points older than 90 days (belt-and-suspenders on top of the
 * TTL index) and purges CANCELLED executions older than 180 days to keep the DB lean.
 */
export function startGpsCleanupJob(): void {
  // Every Sunday at 03:00 UTC
  cron.schedule('0 3 * * 0', async () => {
    await runWithJobLock('gps-cleanup', 60 * 60 * 1000, async () => {
      try {
        await cleanOldGpsPoints();
        await cleanOldCancelledExecutions();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[job:gpsCleanup] Error:', msg);
      }
    });
  });

  console.info('[job:gpsCleanup] Scheduled weekly (Sun 03:00 UTC)');
}

async function cleanOldGpsPoints(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const result = await GpsPoint.deleteMany({ recordedAt: { $lt: cutoff } });
  console.info(`[job:gpsCleanup] Deleted ${result.deletedCount} GPS points older than 90 days`);
}

async function cleanOldCancelledExecutions(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);

  const result = await RouteExecution.deleteMany({
    status: 'CANCELLED',
    scheduledDate: { $lt: cutoff },
  });
  console.info(
    `[job:gpsCleanup] Deleted ${result.deletedCount} cancelled executions older than 180 days`
  );
}
