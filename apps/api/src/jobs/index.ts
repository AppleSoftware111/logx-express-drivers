import { startDailyRouteGeneratorJob } from './dailyRouteGenerator';
import { startDelayCheckerJob } from './delayChecker';
import { startGpsBufferFlusher } from './gpsBufferFlusher';
import { startGpsCleanupJob } from './gpsCleanup';

export function startAllJobs(): void {
  startDailyRouteGeneratorJob();
  startDelayCheckerJob();
  startGpsBufferFlusher();
  startGpsCleanupJob();
  console.info('[jobs] All background jobs started');
}
