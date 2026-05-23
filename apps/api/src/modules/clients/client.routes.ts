import { Router } from 'express';

import { UserRole, createClientSchema, updateClientSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteClient,
  getClients,
  getSingleClient,
  patchClient,
  postClient,
} from './client.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN), getClients);
router.get('/:id', getSingleClient);
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateBody(createClientSchema),
  postClient
);
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateBody(updateClientSchema),
  patchClient
);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteClient);

export default router;
