import { Router } from 'express';
import type { Request, Response } from 'express';

import { UserRole } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireRole } from '../../middleware/roles';
import { sendError, sendSuccess } from '../../utils/apiResponse';
import { sendWhatsApp } from './notification.service';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN));

router.post(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, message } = req.body as { phone: string; message: string };
    const result = await sendWhatsApp(phone, message);
    if (!result.success) {
      return sendError(
        res,
        {
          code: 'NOTIFICATION_DELIVERY_FAILED',
          message: result.error ?? 'Unable to deliver WhatsApp notification',
        },
        result.skipped ? 503 : 502,
        {
          provider: result.provider,
          skipped: result.skipped ?? false,
        }
      );
    }

    return sendSuccess(res, result);
  })
);

export default router;
