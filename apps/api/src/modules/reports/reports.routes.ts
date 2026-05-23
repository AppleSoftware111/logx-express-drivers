import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import { UserRole, reportQuerySchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireRole } from '../../middleware/roles';
import { validateQuery } from '../../middleware/validate';
import { sendSuccess } from '../../utils/apiResponse';
import { cacheKey, withCache } from '../../utils/cache';
import { RouteExecution } from '../../models/RouteExecution.model';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN));

router.get(
  '/summary',
  validateQuery(reportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user!.companyId;
    const { startDate, endDate, driverId, clientId } = req.query as {
      startDate: string;
      endDate: string;
      driverId?: string;
      clientId?: string;
    };

    const rangeStart = new Date(startDate);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    const matchStage: Record<string, unknown> = {
      companyId: new mongoose.Types.ObjectId(companyId),
      scheduledDate: { $gte: rangeStart, $lte: rangeEnd },
    };
    if (driverId) {
      matchStage.driverId = new mongoose.Types.ObjectId(driverId);
    }

    const key = cacheKey('reports:summary', companyId, startDate, endDate, driverId ?? '', clientId ?? '');
    const results = await withCache(key, 120, () => RouteExecution.aggregate([
      { $match: matchStage },
      { $unwind: { path: '$stops', preserveNullAndEmptyArrays: false } },
      ...(clientId
        ? [{ $match: { 'stops.clientId': new mongoose.Types.ObjectId(clientId) } }]
        : []),
      {
        $group: {
          _id: '$driverId',
          totalStops: { $sum: 1 },
          completedStops: {
            $sum: { $cond: [{ $eq: ['$stops.status', 'COMPLETED'] }, 1, 0] },
          },
          skippedStops: {
            $sum: { $cond: [{ $eq: ['$stops.status', 'SKIPPED'] }, 1, 0] },
          },
          avgWaitingTimeMinutes: { $avg: '$stops.waitingTimeMinutes' },
          totalWaitingTimeMinutes: { $sum: { $ifNull: ['$stops.waitingTimeMinutes', 0] } },
          totalDelayMinutes: { $sum: { $ifNull: ['$delayMinutes', 0] } },
          totalExecutions: { $addToSet: '$_id' },
        },
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driver',
        },
      },
      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          driverId: '$_id',
          driverName: '$driver.name',
          totalStops: 1,
          completedStops: 1,
          skippedStops: 1,
          completionRate: {
            $cond: [
              { $gt: ['$totalStops', 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ['$completedStops', '$totalStops'] }, 100] },
                  1,
                ],
              },
              0,
            ],
          },
          avgWaitingTimeMinutes: { $round: ['$avgWaitingTimeMinutes', 1] },
          totalWaitingTimeMinutes: 1,
          totalDelayMinutes: 1,
          totalExecutions: { $size: '$totalExecutions' },
        },
      },
      { $sort: { completionRate: -1 } },
    ]));

    return sendSuccess(res, results);
  })
);

router.get(
  '/csv',
  validateQuery(reportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user!.companyId;
    const { startDate, endDate } = req.query as { startDate: string; endDate: string };

    const rangeStart = new Date(startDate);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    const executions = await RouteExecution.find({
      companyId,
      scheduledDate: { $gte: rangeStart, $lte: rangeEnd },
    })
      .select('scheduledDate scheduledTime status delayMinutes stops driverId routeId')
      .populate('driverId', 'name')
      .populate('routeId', 'name')
      .lean();

    const rows: string[][] = [
      [
        'Date',
        'Route',
        'Driver',
        'Status',
        'Delay (min)',
        'Stop',
        'Client',
        'Stop Status',
        'Waiting Time (min)',
        'Arrived At',
        'Completed At',
      ],
    ];

    for (const exec of executions) {
      for (const stop of exec.stops) {
        rows.push([
          exec.scheduledDate.toISOString().slice(0, 10),
          (exec.routeId as { name?: string })?.name ?? String(exec.routeId),
          (exec.driverId as { name?: string })?.name ?? String(exec.driverId),
          exec.status,
          String(exec.delayMinutes),
          String(stop.order + 1),
          String(stop.clientId),
          stop.status,
          String(stop.waitingTimeMinutes ?? ''),
          stop.arrivedAt?.toISOString() ?? '',
          stop.completedAt?.toISOString() ?? '',
        ]);
      }
    }

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="logx-report-${startDate}-${endDate}.csv"`
    );
    res.send(csv);
  })
);

export default router;
