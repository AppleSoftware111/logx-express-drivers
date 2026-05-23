import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import {
  createVehicle,
  deactivateVehicle,
  getVehicle,
  listVehicles,
  updateVehicle,
} from './vehicle.service';

export const getVehicles = asyncHandler(async (req: Request, res: Response) => {
  const vehicles = await listVehicles(req.user!.companyId);
  return sendSuccess(res, vehicles);
});

export const getSingleVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await getVehicle(req.user!.companyId, req.params.id);
  return sendSuccess(res, vehicle);
});

export const postVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await createVehicle(req.user!.companyId, req.body);
  return sendCreated(res, vehicle);
});

export const patchVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await updateVehicle(req.user!.companyId, req.params.id, req.body);
  return sendSuccess(res, vehicle);
});

export const deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
  await deactivateVehicle(req.user!.companyId, req.params.id);
  return sendSuccess(res, { message: 'Vehicle deactivated' });
});
