import cron from 'node-cron';

import { AlertType } from '@logx/shared';

import { Alert } from '../models/Alert.model';
import { Route } from '../models/Route.model';
import { RouteExecution } from '../models/RouteExecution.model';
import { Driver } from '../models/Driver.model';
import { alertAlreadyExists, createAlert } from '../modules/alerts/alert.service';
import {
  buildDelayAlertMessage,
  sendWhatsApp,
} from '../modules/notifications/notification.service';
import { getIO } from '../socket';
import { calcDelayMinutes } from '../utils/timeCalc';

const DELAY_THRESHOLDS: { minutes: number; type: AlertType }[] = [
  { minutes: 15, type: AlertType.DELAY_15 },
  { minutes: 30, type: AlertType.DELAY_30 },
  { minutes: 60, type: AlertType.DELAY_60 },
];

export function startDelayCheckerJob(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkDelays();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[job:delayChecker] Error:', msg);
    }
  });

  console.info('[job:delayChecker] Scheduled every 5 minutes');
}

async function checkDelays(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const pendingExecutions = await RouteExecution.find({
    scheduledDate: today,
    status: { $in: ['PENDING', 'ASSIGNED', 'ACCEPTED'] },
  })
    .select('companyId routeId driverId scheduledDate scheduledTime status delayMinutes')
    .populate('routeId', 'name')
    .lean();

  for (const execution of pendingExecutions) {
    const delayMinutes = calcDelayMinutes(execution.scheduledDate, execution.scheduledTime);

    if (delayMinutes === 0) continue;

    // Update delayMinutes in DB
    await RouteExecution.findByIdAndUpdate(execution._id, {
      $set: { delayMinutes },
    });

    const routeName =
      (execution.routeId as { name?: string })?.name ?? String(execution.routeId);
    const companyId = execution.companyId.toString();

    for (const threshold of DELAY_THRESHOLDS) {
      if (delayMinutes < threshold.minutes) continue;

      const exists = await alertAlreadyExists(execution._id.toString(), threshold.type);
      if (exists) continue;

      const message = buildDelayAlertMessage(routeName, delayMinutes);
      const alertId = await createAlert(
        companyId,
        execution._id.toString(),
        threshold.type,
        message
      );

      // Real-time socket broadcast
      try {
        const io = getIO();
        const alert = await Alert.findById(alertId).lean();
        io.to(`admin:${companyId}`).emit('admin:alert', alert);
      } catch {
        // Socket not available during tests
      }

      // WhatsApp to driver
      try {
        const driver = await Driver.findById(execution.driverId).select('phone name').lean();
        if (driver?.phone) {
          await sendWhatsApp(driver.phone, message);
        }
      } catch {
        // Non-critical
      }
    }
  }
}
