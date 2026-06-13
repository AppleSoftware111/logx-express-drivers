import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { buildMeta, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import {
  completeStop,
  generateExecutionsForDate,
  getExecution,
  getExecutionAudits,
  getExecutionAlerts,
  getExecutionGpsTrack,
  getTodayExecutions,
  listExecutions,
  receiveRoute,
  setStopArrived,
  setStopInProgress,
  setStopOnTheWay,
  skipStop,
  substituteDriver,
  syncWorkflowEvents,
  updateExecutionStatus,
  workflowRouteCompleted,
  workflowStopArrived,
  workflowStopCollected,
  workflowStopSkipped,
} from './execution.service';

export const getExecutions = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const companyId = req.user!.companyId;

  const { executions, total } = await listExecutions(
    companyId,
    {
      date: req.query.date as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      driverId: req.query.driverId as string,
      status: req.query.status as string,
      routeId: req.query.routeId as string,
    },
    page,
    limit
  );

  return sendPaginated(res, executions, buildMeta(page, limit, total));
});

export const getTodayExecutionsController = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const driverId =
    req.user!.role === 'DRIVER' ? req.user!.driverId : (req.query.driverId as string);

  const executions = await getTodayExecutions(companyId, driverId);
  return sendSuccess(res, executions);
});

export const getSingleExecution = asyncHandler(async (req: Request, res: Response) => {
  const execution = await getExecution(req.user!.companyId, req.params.id);
  return sendSuccess(res, execution);
});

export const getExecutionAuditsController = asyncHandler(async (req: Request, res: Response) => {
  const audits = await getExecutionAudits(req.user!.companyId, req.params.id);
  return sendSuccess(res, audits);
});

export const patchExecutionStatus = asyncHandler(async (req: Request, res: Response) => {
  const execution = await updateExecutionStatus(
    req.user!.companyId,
    req.params.id,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postSubstituteDriver = asyncHandler(async (req: Request, res: Response) => {
  const execution = await substituteDriver(req.user!.companyId, req.params.id, req.body);
  return sendSuccess(res, execution);
});

export const postStopArrived = asyncHandler(async (req: Request, res: Response) => {
  const execution = await setStopArrived(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postRouteReceived = asyncHandler(async (req: Request, res: Response) => {
  const execution = await receiveRoute(req.user!.companyId, req.params.id, req.body, req.user);
  return sendSuccess(res, execution);
});

export const postStopOnTheWay = asyncHandler(async (req: Request, res: Response) => {
  const execution = await setStopOnTheWay(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postWorkflowStopArrived = asyncHandler(async (req: Request, res: Response) => {
  const execution = await workflowStopArrived(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postWorkflowStopCollected = asyncHandler(async (req: Request, res: Response) => {
  const execution = await workflowStopCollected(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postWorkflowStopSkipped = asyncHandler(async (req: Request, res: Response) => {
  const execution = await workflowStopSkipped(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postRouteCompleted = asyncHandler(async (req: Request, res: Response) => {
  const execution = await workflowRouteCompleted(
    req.user!.companyId,
    req.params.id,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postSyncWorkflowEvents = asyncHandler(async (req: Request, res: Response) => {
  const result = await syncWorkflowEvents(req.user!.companyId, req.body.events, req.user);
  return sendSuccess(res, result);
});

export const postStopInProgress = asyncHandler(async (req: Request, res: Response) => {
  const execution = await setStopInProgress(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postStopComplete = asyncHandler(async (req: Request, res: Response) => {
  const execution = await completeStop(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    req.body,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postStopSkip = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const execution = await skipStop(
    req.user!.companyId,
    req.params.id,
    req.params.stopId,
    reason,
    req.user
  );
  return sendSuccess(res, execution);
});

export const postGenerateExecutions = asyncHandler(async (req: Request, res: Response) => {
  const result = await generateExecutionsForDate(req.user!.companyId, req.body);
  return sendSuccess(res, result);
});

export const getGpsTrack = asyncHandler(async (req: Request, res: Response) => {
  const track = await getExecutionGpsTrack(req.params.id);
  return sendSuccess(res, track);
});

export const getExecutionAlertsController = asyncHandler(
  async (req: Request, res: Response) => {
    const alerts = await getExecutionAlerts(req.user!.companyId, req.params.id, req.locale);
    return sendSuccess(res, alerts);
  }
);
