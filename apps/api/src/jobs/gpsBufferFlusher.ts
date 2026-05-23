import { GPS_BUFFER_FLUSH_INTERVAL_MS } from '@logx/shared';

import { flushGpsBuffer } from '../modules/tracking/tracking.service';

export function startGpsBufferFlusher(): void {
  setInterval(async () => {
    try {
      const count = await flushGpsBuffer();
      if (count > 0) {
        console.info(`[job:gpsBufferFlusher] Flushed ${count} GPS points to DB`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[job:gpsBufferFlusher] Flush error:', msg);
    }
  }, GPS_BUFFER_FLUSH_INTERVAL_MS);

  console.info(
    `[job:gpsBufferFlusher] GPS buffer flush every ${GPS_BUFFER_FLUSH_INTERVAL_MS / 1000}s`
  );
}
