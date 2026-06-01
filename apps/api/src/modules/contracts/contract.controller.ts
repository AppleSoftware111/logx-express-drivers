import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import {
  createContract,
  deactivateContract,
  getContract,
  listContracts,
  updateContract,
} from './contract.service';

export const getContracts = asyncHandler(async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string | undefined;
  const contracts = await listContracts(req.user!.companyId, clientId);
  return sendSuccess(res, contracts);
});

export const getSingleContract = asyncHandler(async (req: Request, res: Response) => {
  const contract = await getContract(req.user!.companyId, req.params.id);
  return sendSuccess(res, contract);
});

export const postContract = asyncHandler(async (req: Request, res: Response) => {
  const contract = await createContract(req.user!.companyId, req.body);
  return sendCreated(res, contract);
});

export const patchContract = asyncHandler(async (req: Request, res: Response) => {
  const contract = await updateContract(req.user!.companyId, req.params.id, req.body);
  return sendSuccess(res, contract);
});

export const deleteContract = asyncHandler(async (req: Request, res: Response) => {
  await deactivateContract(req.user!.companyId, req.params.id);
  return sendSuccess(res, { success: true });
});
