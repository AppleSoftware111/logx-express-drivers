import cron from 'node-cron';

import { env } from '../config/env';
import { AlertType } from '@logx/shared';

import { Alert } from '../models/Alert.model';
import { RouteExecution } from '../models/RouteExecution.model';
import { Driver } from '../models/Driver.model';
import { User } from '../models/User.model';
import { alertAlreadyExists, createAlert } from '../modules/alerts/alert.service';
import {
  buildDelayAlertMessage,
  sendWhatsApp,
} from '../modules/notifications/notification.service';
import { invalidateCache } from '../utils/cache';
import { calcDelayMinutes, getCurrentBusinessDate } from '../utils/timeCalc';
import { runWithJobLock } from './jobLock';
import { emitAdminAlert, emitExecutionRealtimeUpdate } from '../socket/realtime';

const DELAY_THRESHOLDS: { minutes: number; type: AlertType }[] = [
  { minutes: 15, type: AlertType.DELAY_15 },
  { minutes: 30, type: AlertType.DELAY_30 },
  { minutes: 60, type: AlertType.DELAY_60 },
];

export function startDelayCheckerJob(): void {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      await runWithJobLock('delay-checker', 4 * 60 * 1000, async () => {
        try {
          await checkDelays();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[job:delayChecker] Error:', msg);
        }
      });
    },
    { timezone: env.APP_TIMEZONE }
  );

  console.info(`[job:delayChecker] Scheduled every 5 minutes (${env.APP_TIMEZONE})`);
}

async function checkDelays(): Promise<void> {
  const today = getCurrentBusinessDate();

  const pendingExecutions = await RouteExecution.find({
    scheduledDate: today,
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  })
    .select('companyId routeId driverId scheduledDate scheduledTime status delayMinutes actualStartTime')
    .populate('routeId', 'name')
    .lean();

  const touchedCompanies = new Set<string>();

  for (const execution of pendingExecutions) {
    const companyId = execution.companyId.toString();
    const delayMinutes = calcDelayMinutes(
      execution.scheduledDate,
      execution.scheduledTime,
      execution.actualStartTime ?? new Date()
    );

    if (delayMinutes !== execution.delayMinutes) {
      await RouteExecution.findByIdAndUpdate(execution._id, {
        $set: { delayMinutes },
      });
      touchedCompanies.add(execution.companyId.toString());
      emitExecutionRealtimeUpdate(companyId, {
        event: 'DELAY_UPDATED',
        executionId: execution._id.toString(),
        routeId:
          typeof execution.routeId === 'object' && execution.routeId !== null && '_id' in execution.routeId
            ? String(execution.routeId._id)
            : String(execution.routeId),
        driverId: execution.driverId ? String(execution.driverId) : undefined,
        status: execution.status,
        timestamp: new Date().toISOString(),
      });
    }

    if (delayMinutes === 0) continue;

    const routeName =
      (execution.routeId as { name?: string })?.name ?? String(execution.routeId);

    for (const threshold of DELAY_THRESHOLDS) {
      if (delayMinutes < threshold.minutes) continue;

      const exists = await alertAlreadyExists(execution._id.toString(), threshold.type);
      if (exists) continue;

      const message = buildDelayAlertMessage(routeName, delayMinutes);
      const alertId = await createAlert(
        companyId,
        execution._id.toString(),
        threshold.type,
        message,
        'delayWhatsApp',
        { routeName, minutes: delayMinutes }
      );

      const alert = await Alert.findById(alertId).lean();
      if (alert) {
        emitAdminAlert(companyId, alert);
      }

      // WhatsApp to driver
      try {
        const driver = await Driver.findById(execution.driverId).select('phone name').lean();
        if (driver?.phone) {
          const driverUser = await User.findOne({ driverId: execution.driverId })
            .select('locale')
            .lean();
          await sendWhatsApp(
            driver.phone,
            buildDelayAlertMessage(routeName, delayMinutes, driverUser?.locale ?? 'pt')
          );
        }
      } catch {
        // Non-critical
      }
    }
  }

  await Promise.all(
    [...touchedCompanies].map((companyId) =>
      invalidateCache(`dashboard:summary:${companyId}:*`)
    )
  );
}
