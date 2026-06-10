import { Router } from 'express';
import type { Request, Response } from 'express';

import { DRIVER_LOCATION_STALE_WINDOW_MS } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { cacheKey, withCache } from '../../utils/cache';
import { Alert } from '../../models/Alert.model';
import { Driver } from '../../models/Driver.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import { localizeAlertDocument } from '../alerts/alert.service';
import { getCurrentBusinessDate, toDateString } from '../../utils/timeCalc';

const router = Router();

router.use(authenticate);

router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user!.companyId;
    const today = getCurrentBusinessDate();

    const key = cacheKey('dashboard:summary', companyId, toDateString(today), req.locale);

    const summary = await withCache(key, 30, async () => {
      const [
        onlineDrivers,
        activeRoutes,
        delayedRoutes,
        completedToday,
        unreadAlerts,
        recentAlerts,
      ] = await Promise.all([
        Driver.countDocuments({ companyId, isOnline: true, isActive: true }),
        RouteExecution.countDocuments({
          companyId,
          scheduledDate: today,
          status: { $in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        }),
        RouteExecution.countDocuments({
          companyId,
          scheduledDate: today,
          delayMinutes: { $gte: 15 },
          status: { $nin: ['COMPLETED', 'CANCELLED'] },
        }),
        RouteExecution.countDocuments({
          companyId,
          scheduledDate: today,
          status: 'COMPLETED',
        }),
        Alert.countDocuments({ companyId, isRead: false }),
        Alert.find({ companyId })
          .select('-__v')
          .populate('executionId', 'scheduledDate routeId')
          .lean()
          .sort({ createdAt: -1 })
          .limit(10),
      ]);

      const activeExecutions = await RouteExecution.find({
        companyId,
        scheduledDate: today,
        status: { $in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
      })
        .select('status delayMinutes scheduledTime routeId driverId')
        .populate('routeId', 'name')
        .populate('driverId', 'name isOnline currentLocation')
        .lean()
        .sort({ scheduledTime: 1 });

      return {
        cards: {
          onlineDrivers,
          activeRoutes,
          delayedRoutes,
          completedToday,
          unreadAlerts,
        },
        recentAlerts: recentAlerts.map((alert) => localizeAlertDocument(alert, req.locale)),
        activeExecutions,
      };
    });

    return sendSuccess(res, summary);
  })
);

router.get(
  '/live-drivers',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user!.companyId;
    const staleCutoff = new Date(Date.now() - DRIVER_LOCATION_STALE_WINDOW_MS);

    const drivers = await Driver.find({
      companyId,
      isActive: true,
      $or: [{ isOnline: true }, { 'currentLocation.updatedAt': { $gte: staleCutoff } }],
    })
      .select('name currentLocation vehicleId')
      .populate('vehicleId', 'plate type')
      .lean();

    return sendSuccess(res, drivers);
  })
);

export default router;
