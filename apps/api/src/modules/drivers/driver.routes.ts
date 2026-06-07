import { Router } from 'express';

import { UserRole, createDriverSchema, updateDriverSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteDriver,
  getDrivers,
  getSingleDriver,
  patchDriverActiveStatus,
  patchDriver,
  patchDriverOnlineStatus,
  postDriver,
} from './driver.controller';

const router = Router();

router.use(authenticate);

router.get('/', getDrivers);
router.get('/:id', getSingleDriver);
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(createDriverSchema),
  postDriver
);
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(updateDriverSchema),
  patchDriver
);
router.patch(
  '/:id/active',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  patchDriverActiveStatus
);
router.patch(
  '/:id/online',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.DRIVER, UserRole.SUPER_ADMIN),
  patchDriverOnlineStatus
);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteDriver);

export default router;
