import { Router } from 'express';

import {
  UserRole,
  completeStopSchema,
  generateExecutionsSchema,
  substituteDriverSchema,
  updateExecutionStatusSchema,
  workflowActionSchema,
  workflowSyncSchema,
} from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  getExecutionAlertsController,
  getExecutionAuditsController,
  getExecutions,
  getGpsTrack,
  getSingleExecution,
  getTodayExecutionsController,
  patchExecutionStatus,
  postGenerateExecutions,
  postRouteCompleted,
  postRouteReceived,
  postStopArrived,
  postStopComplete,
  postStopInProgress,
  postStopOnTheWay,
  postStopSkip,
  postSubstituteDriver,
  postSyncWorkflowEvents,
  postWorkflowStopArrived,
  postWorkflowStopCollected,
  postWorkflowStopSkipped,
} from './execution.controller';

const router = Router();

router.use(authenticate);

router.get('/', getExecutions);
router.get('/today', getTodayExecutionsController);
router.get('/:id', getSingleExecution);
router.get('/:id/gps-track', getGpsTrack);
router.get('/:id/alerts', getExecutionAlertsController);
router.get('/:id/audits', getExecutionAuditsController);
router.post(
  '/generate',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(generateExecutionsSchema),
  postGenerateExecutions
);

router.post('/sync-events', validateBody(workflowSyncSchema), postSyncWorkflowEvents);

router.patch(
  '/:id/status',
  validateBody(updateExecutionStatusSchema),
  patchExecutionStatus
);

router.post(
  '/:id/substitute-driver',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN),
  validateBody(substituteDriverSchema),
  postSubstituteDriver
);

// Compliance workflow — idempotent and suitable for offline replay
router.post('/:id/received', validateBody(workflowActionSchema), postRouteReceived);
router.post('/:id/completed', validateBody(workflowActionSchema), postRouteCompleted);
router.post(
  '/:id/stops/:stopId/on-the-way',
  validateBody(workflowActionSchema),
  postStopOnTheWay
);
router.post(
  '/:id/stops/:stopId/workflow-arrived',
  validateBody(workflowActionSchema),
  postWorkflowStopArrived
);
router.post(
  '/:id/stops/:stopId/collected',
  validateBody(workflowActionSchema),
  postWorkflowStopCollected
);
router.post(
  '/:id/stops/:stopId/workflow-skip',
  validateBody(workflowActionSchema),
  postWorkflowStopSkipped
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
