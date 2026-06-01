import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import {
  createRoute,
  deleteRoute,
  getRoute,
  listRoutes,
  previewRouteSchedule,
  toggleRouteActive,
  updateRoute,
} from './route.service';

export const getRoutes = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
  const isTemplate =
    req.query.isTemplate !== undefined ? req.query.isTemplate === 'true' : undefined;

  const routes = await listRoutes(companyId, {
    isActive,
    isTemplate,
    driverId: req.query.driverId as string,
    clientId: req.query.clientId as string,
  });
  return sendSuccess(res, routes);
});

export const getSingleRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await getRoute(req.user!.companyId, req.params.id);
  return sendSuccess(res, route);
});

export const postRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await createRoute(req.user!.companyId, req.body);
  return sendCreated(res, route);
});

export const patchRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await updateRoute(req.user!.companyId, req.params.id, req.body);
  return sendSuccess(res, route);
});

export const patchRouteActive = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const route = await toggleRouteActive(req.user!.companyId, req.params.id, isActive);
  return sendSuccess(res, route);
});

export const deleteRouteController = asyncHandler(async (req: Request, res: Response) => {
  await deleteRoute(req.user!.companyId, req.params.id);
  return sendSuccess(res, { success: true });
});

export const getRouteSchedulePreview = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const preview = await previewRouteSchedule(req.user!.companyId, req.params.id, days);
  return sendSuccess(res, preview);
});
