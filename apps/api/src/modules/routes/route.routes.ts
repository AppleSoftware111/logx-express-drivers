import { Router } from 'express';

import { UserRole, createRouteSchema, routeEditSyncPreviewSchema, updateRouteSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteRouteController,
  getRouteSchedulePreview,
  getRoutes,
  getSingleRoute,
  patchRoute,
  patchRouteActive,
  postRoute,
  postRouteEditSyncPreview,
} from './route.controller';

const router = Router();

router.use(authenticate);

router.get('/', getRoutes);
router.get('/:id', getSingleRoute);
router.get('/:id/schedule-preview', getRouteSchedulePreview);
router.post(
  '/:id/edit-sync-preview',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(routeEditSyncPreviewSchema),
  postRouteEditSyncPreview
);
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(createRouteSchema),
  postRoute
);
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(updateRouteSchema),
  patchRoute
);
router.patch(
  '/:id/active',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  patchRouteActive
);
router.delete(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deleteRouteController
);

export default router;
