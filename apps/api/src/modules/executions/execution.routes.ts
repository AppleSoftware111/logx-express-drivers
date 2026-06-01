import { Router } from 'express';

import {
  UserRole,
  completeStopSchema,
  generateExecutionsSchema,
  substituteDriverSchema,
  updateExecutionStatusSchema,
} from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  getExecutionAlertsController,
  getExecutions,
  getGpsTrack,
  getSingleExecution,
  getTodayExecutionsController,
  patchExecutionStatus,
  postGenerateExecutions,
  postStopArrived,
  postStopComplete,
  postStopInProgress,
  postStopSkip,
  postSubstituteDriver,
} from './execution.controller';

const router = Router();

router.use(authenticate);

router.get('/', getExecutions);
router.get('/today', getTodayExecutionsController);
router.get('/:id', getSingleExecution);
router.get('/:id/gps-track', getGpsTrack);
router.get('/:id/alerts', getExecutionAlertsController);
router.post(
  '/generate',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(generateExecutionsSchema),
  postGenerateExecutions
);

router.patch(
  '/:id/status',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(updateExecutionStatusSchema),
  patchExecutionStatus
);

router.post(
  '/:id/substitute-driver',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(substituteDriverSchema),
  postSubstituteDriver
);

// Stop workflow — accessible by DRIVER and OPERATOR+
router.post('/:id/stops/:stopId/arrived', postStopArrived);
router.post('/:id/stops/:stopId/start', postStopInProgress);
router.post(
  '/:id/stops/:stopId/complete',
  validateBody(completeStopSchema),
  postStopComplete
);
router.post('/:id/stops/:stopId/skip', postStopSkip);

export default router;
