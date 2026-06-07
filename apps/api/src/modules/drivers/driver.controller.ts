import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import {
  createDriver,
  deactivateDriver,
  getDriver,
  listDrivers,
  toggleDriverActive,
  toggleDriverOnline,
  updateDriver,
} from './driver.service';

export const getDrivers = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const onlineOnly = req.query.online === 'true';
  const isActive =
    req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const drivers = await listDrivers(companyId, onlineOnly, isActive);
  return sendSuccess(res, drivers);
});

export const getSingleDriver = asyncHandler(async (req: Request, res: Response) => {
  const driver = await getDriver(req.user!.companyId, req.params.id);
  return sendSuccess(res, driver);
});

export const postDriver = asyncHandler(async (req: Request, res: Response) => {
  const driver = await createDriver(req.user!.companyId, req.body);
  return sendCreated(res, driver);
});

export const patchDriver = asyncHandler(async (req: Request, res: Response) => {
  const driver = await updateDriver(req.user!.companyId, req.params.id, req.body);
  return sendSuccess(res, driver);
});

export const patchDriverOnlineStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isOnline } = req.body as { isOnline: boolean };
  const driver = await toggleDriverOnline(req.user!.companyId, req.params.id, isOnline);
  return sendSuccess(res, driver);
});

export const deleteDriver = asyncHandler(async (req: Request, res: Response) => {
  await deactivateDriver(req.user!.companyId, req.params.id);
  return sendSuccess(res, { success: true });
});

export const patchDriverActiveStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const driver = await toggleDriverActive(req.user!.companyId, req.params.id, isActive);
  return sendSuccess(res, driver);
});
