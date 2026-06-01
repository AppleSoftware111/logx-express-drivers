import cron from 'node-cron';

import { env } from '../config/env';
import { Route } from '../models/Route.model';
import { RouteExecution } from '../models/RouteExecution.model';
import { Driver } from '../models/Driver.model';
import { User } from '../models/User.model';
import {
  buildRouteAssignedMessage,
  sendWhatsApp,
} from '../modules/notifications/notification.service';
import {
  businessDateStringToUtcDate,
  getCurrentBusinessDateString,
  routeRunsOnDate,
  toDateString,
} from '../utils/timeCalc';

export function startDailyRouteGeneratorJob(): void {
  cron.schedule(
    '1 0 * * *',
    async () => {
      console.info('[job:dailyRouteGenerator] Starting daily route generation');

      const today = businessDateStringToUtcDate(getCurrentBusinessDateString());

      try {
        await generateRoutesForDate(today);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[job:dailyRouteGenerator] Fatal error:', msg);
      }
    },
    { timezone: env.APP_TIMEZONE }
  );

  console.info(`[job:dailyRouteGenerator] Scheduled for 00:01 daily (${env.APP_TIMEZONE})`);
}

export async function generateRoutesForDate(
  targetDate: Date
): Promise<{ generated: number; skipped: number }> {
  const normalizedDate = new Date(targetDate);
  normalizedDate.setUTCHours(0, 0, 0, 0);

  const activeRoutes = await Route.find({ isActive: true, isTemplate: false })
    .populate('defaultDriverId', 'name phone')
    .lean();

  let generated = 0;
  let skipped = 0;

  for (const route of activeRoutes) {
    try {
      const shouldRun = routeRunsOnDate(route, normalizedDate);
      if (!shouldRun) {
        skipped++;
        continue;
      }

      if (!route.defaultDriverId) {
        console.warn(`[job:dailyRouteGenerator] Route ${route._id} has no default driver, skipping`);
        skipped++;
        continue;
      }

      const executionData = {
        companyId: route.companyId,
        routeId: route._id,
        contractId: route.contractId,
        scheduledDate: normalizedDate,
        scheduledTime: route.scheduledTime,
        driverId: route.defaultDriverId,
        originalDriverId: route.defaultDriverId,
        isSubstitution: false,
        status: 'PENDING',
        delayMinutes: 0,
        stops: route.stops.map((s, i) => ({
          routeStopIndex: i,
          clientId: s.clientId,
          order: s.order,
          address: s.address,
          location: s.location,
          plannedTime: s.plannedTime,
          expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
          type: s.type,
          instructions: s.instructions,
          status: 'PENDING',
        })),
      };

      // Atomic upsert — safe if cron fires twice
      const result = await RouteExecution.findOneAndUpdate(
        { routeId: route._id, scheduledDate: normalizedDate },
        { $setOnInsert: executionData },
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );

      if (!result) {
        // null means document was inserted (new creation)
        generated++;

        // Send WhatsApp notification to driver
        const driver = await Driver.findById(route.defaultDriverId).select('name phone').lean();
        if (driver?.phone) {
          const driverUser = await User.findOne({ driverId: route.defaultDriverId })
            .select('locale')
            .lean();
          await sendWhatsApp(
            driver.phone,
            buildRouteAssignedMessage(
              driver.name,
              route.name,
              route.scheduledTime,
              driverUser?.locale ?? 'pt'
            )
          );
        }
      } else {
        skipped++; // Already existed
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[job:dailyRouteGenerator] Error on route ${route._id}: ${msg}`);
      skipped++;
    }
  }

  console.info(
    `[job:dailyRouteGenerator] Date: ${toDateString(normalizedDate)} — Generated: ${generated}, Skipped: ${skipped}`
  );
  return { generated, skipped };
}
