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
import { getOnlineDrivers, processDriverGpsPayload, updateDriverLocation } from './tracking.service';

const router = Router();
const driverTrackedLocationSchema = gpsPointSchema.omit({ driverId: true });
const trackedLocationBatchSchema = z.object({
  points: z.array(driverTrackedLocationSchema).min(1).max(200),
});
const presenceLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  recordedAt: z.string().datetime({ offset: true }),
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

router.post(
  '/presence',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.driverId) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 403);
    }

    const payload = presenceLocationSchema.parse(req.body);
    await updateDriverLocation(req.user.driverId, payload.lat, payload.lng);

    emitDriverLocationUpdate(req.user.companyId, {
      driverId: req.user.driverId,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed,
      heading: payload.heading,
      accuracy: payload.accuracy,
      timestamp: payload.recordedAt,
    });

    return sendSuccess(res, { accepted: true });
  })
);

export default router;
