import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { ApiErrorCode } from '@logx/i18n';
import { gpsPointSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { emitDriverLocationUpdate, emitExecutionRealtimeUpdate } from '../../socket/realtime';
import { getOnlineDrivers, processDriverGpsPayload } from './tracking.service';

const router = Router();
const driverTrackedLocationSchema = gpsPointSchema.omit({ driverId: true });
const trackedLocationBatchSchema = z.object({
  points: z.array(driverTrackedLocationSchema).min(1).max(200),
});

router.use(authenticate);

router.get(
  '/online-drivers',
  asyncHandler(async (req: Request, res: Response) => {
    const drivers = await getOnlineDrivers(req.user!.companyId);
    return sendSuccess(res, drivers);
  })
);

router.post(
  '/location',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.driverId) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 403);
    }

    const { points } = trackedLocationBatchSchema.parse(req.body);

    for (const point of points) {
      const arrival = await processDriverGpsPayload(req.user.companyId, req.user.driverId, point);

      emitDriverLocationUpdate(req.user.companyId, {
        driverId: req.user.driverId,
        executionId: point.executionId,
        lat: point.lat,
        lng: point.lng,
        speed: point.speed,
        heading: point.heading,
        accuracy: point.accuracy,
        timestamp: point.recordedAt,
      });

      if (arrival) {
        emitExecutionRealtimeUpdate(req.user.companyId, {
          executionId: arrival.executionId,
          event: 'STOP_ARRIVED',
          stopId: arrival.stopId,
          clientName: arrival.clientName,
          driverId: req.user.driverId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return sendSuccess(res, { accepted: points.length });
  })
);

export default router;
