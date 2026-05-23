import { Router } from 'express';
import type { Request, Response } from 'express';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { buildMeta, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import {
  getUnreadCount,
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
} from './alert.service';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;

    const { alerts, total } = await listAlerts(
      req.user!.companyId,
      { isRead },
      page,
      limit
    );
    return sendPaginated(res, alerts, buildMeta(page, limit, total));
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const count = await getUnreadCount(req.user!.companyId);
    return sendSuccess(res, { count });
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    await markAllAlertsRead(req.user!.companyId);
    return sendSuccess(res, { message: 'All alerts marked as read' });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const alert = await markAlertRead(req.user!.companyId, req.params.id);
    return sendSuccess(res, alert);
  })
);

export default router;
