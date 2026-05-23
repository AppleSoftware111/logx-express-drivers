import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { buildMeta, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import {
  createCompany,
  deactivateCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from './company.service';

export const getCompanies = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const { companies, total } = await listCompanies(page, limit);
  return sendPaginated(res, companies, buildMeta(page, limit, total));
});

export const getSingleCompany = asyncHandler(async (req: Request, res: Response) => {
  const company = await getCompany(req.params.id);
  return sendSuccess(res, company);
});

export const postCompany = asyncHandler(async (req: Request, res: Response) => {
  const company = await createCompany(req.body);
  return sendCreated(res, company);
});

export const patchCompany = asyncHandler(async (req: Request, res: Response) => {
  const company = await updateCompany(req.params.id, req.body);
  return sendSuccess(res, company);
});

export const deleteCompany = asyncHandler(async (req: Request, res: Response) => {
  await deactivateCompany(req.params.id);
  return sendSuccess(res, { message: 'Company deactivated' });
});
