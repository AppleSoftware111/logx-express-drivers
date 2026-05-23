import { Router } from 'express';
import type { Request, Response } from 'express';

import { UserRole } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireRole } from '../../middleware/roles';
import { sendSuccess } from '../../utils/apiResponse';
import { sendWhatsApp } from './notification.service';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN));

router.post(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, message } = req.body as { phone: string; message: string };
    await sendWhatsApp(phone, message);
    return sendSuccess(res, { message: 'Notification sent' });
  })
);

export default router;
