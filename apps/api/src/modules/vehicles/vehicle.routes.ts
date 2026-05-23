import { Router } from 'express';

import { UserRole, createVehicleSchema, updateVehicleSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteVehicle,
  getSingleVehicle,
  getVehicles,
  patchVehicle,
  postVehicle,
} from './vehicle.controller';

const router = Router();

router.use(authenticate);

router.get('/', getVehicles);
router.get('/:id', getSingleVehicle);
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateBody(createVehicleSchema),
  postVehicle
);
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateBody(updateVehicleSchema),
  patchVehicle
);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteVehicle);

export default router;
