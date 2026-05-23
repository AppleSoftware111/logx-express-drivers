import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { createBranch, deleteBranch, getBranch, listBranches, updateBranch } from './branch.service';

export const getBranches = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.role === 'SUPER_ADMIN' ? req.params.companyId : req.user!.companyId;
  const branches = await listBranches(companyId);
  return sendSuccess(res, branches);
});

export const getSingleBranch = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const branch = await getBranch(companyId, req.params.id);
  return sendSuccess(res, branch);
});

export const postBranch = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const branch = await createBranch(companyId, req.body);
  return sendCreated(res, branch);
});

export const patchBranch = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const branch = await updateBranch(companyId, req.params.id, req.body);
  return sendSuccess(res, branch);
});

export const deleteBranchController = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  await deleteBranch(companyId, req.params.id);
  return sendSuccess(res, { message: 'Branch deactivated' });
});
