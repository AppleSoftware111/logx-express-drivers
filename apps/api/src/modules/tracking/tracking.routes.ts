import { Router } from 'express';
import type { Request, Response } from 'express';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { getOnlineDrivers } from './tracking.service';

const router = Router();

router.use(authenticate);

router.get(
  '/online-drivers',
  asyncHandler(async (req: Request, res: Response) => {
    const drivers = await getOnlineDrivers(req.user!.companyId);
    return sendSuccess(res, drivers);
  })
);

export default router;
