import cron from 'node-cron';

import { Route } from '../models/Route.model';
import { RouteExecution } from '../models/RouteExecution.model';
import { Driver } from '../models/Driver.model';
import {
  buildRouteAssignedMessage,
  sendWhatsApp,
} from '../modules/notifications/notification.service';
import { matchesDayOfWeek, toDateString } from '../utils/timeCalc';

export function startDailyRouteGeneratorJob(): void {
  // Runs every day at 00:01 UTC
  cron.schedule('1 0 * * *', async () => {
    console.info('[job:dailyRouteGenerator] Starting daily route generation');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dayOfWeek = today.getUTCDay();
    const dayOfMonth = today.getUTCDate();

    try {
      await generateRoutesForDate(today, dayOfWeek, dayOfMonth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[job:dailyRouteGenerator] Fatal error:', msg);
    }
  });

  console.info('[job:dailyRouteGenerator] Scheduled for 00:01 UTC daily');
}

export async function generateRoutesForDate(
  targetDate: Date,
  dayOfWeek?: number,
  dayOfMonth?: number
): Promise<{ generated: number; skipped: number }> {
  const dow = dayOfWeek ?? targetDate.getUTCDay();
  const dom = dayOfMonth ?? targetDate.getUTCDate();

  const activeRoutes = await Route.find({ isActive: true, isTemplate: false })
    .populate('defaultDriverId', 'name phone')
    .lean();

  let generated = 0;
  let skipped = 0;

  for (const route of activeRoutes) {
    try {
      const shouldRun = routeShouldRunToday(route, dow, dom);
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
        scheduledDate: targetDate,
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
          type: s.type,
          status: 'PENDING',
        })),
      };

      // Atomic upsert — safe if cron fires twice
      const result = await RouteExecution.findOneAndUpdate(
        { routeId: route._id, scheduledDate: targetDate },
        { $setOnInsert: executionData },
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );

      if (!result) {
        // null means document was inserted (new creation)
        generated++;

        // Send WhatsApp notification to driver
        const driver = await Driver.findById(route.defaultDriverId).select('name phone').lean();
        if (driver?.phone) {
          await sendWhatsApp(
            driver.phone,
            buildRouteAssignedMessage(driver.name, route.name, route.scheduledTime)
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
    `[job:dailyRouteGenerator] Date: ${toDateString(targetDate)} — Generated: ${generated}, Skipped: ${skipped}`
  );
  return { generated, skipped };
}

function routeShouldRunToday(
  route: { recurrenceType: string; daysOfWeek: number[] },
  dayOfWeek: number,
  dayOfMonth: number
): boolean {
  switch (route.recurrenceType) {
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return route.daysOfWeek.includes(dayOfWeek);
    case 'MONTHLY':
      return route.daysOfWeek.includes(dayOfMonth);
    case 'CUSTOM':
      return route.daysOfWeek.includes(dayOfWeek);
    default:
      return false;
  }
}
