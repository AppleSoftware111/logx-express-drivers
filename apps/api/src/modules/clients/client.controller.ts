import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { buildMeta, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import {
  createClient,
  deactivateClient,
  getClient,
  listClients,
  toggleClientActive,
  updateClient,
} from './client.service';

export const getClients = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const type = req.query.type as string | undefined;
  const isActive =
    req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const { clients, total } = await listClients(companyId, type, isActive, page, limit);
  return sendPaginated(res, clients, buildMeta(page, limit, total));
});

export const getSingleClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await getClient(req.user!.companyId, req.params.id);
  return sendSuccess(res, client);
});

export const postClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await createClient(req.user!.companyId, req.body);
  return sendCreated(res, client);
});

export const patchClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await updateClient(req.user!.companyId, req.params.id, req.body);
  return sendSuccess(res, client);
});

export const deleteClient = asyncHandler(async (req: Request, res: Response) => {
  await deactivateClient(req.user!.companyId, req.params.id);
  return sendSuccess(res, { success: true });
});

export const patchClientActive = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const client = await toggleClientActive(req.user!.companyId, req.params.id, isActive);
  return sendSuccess(res, client);
});
