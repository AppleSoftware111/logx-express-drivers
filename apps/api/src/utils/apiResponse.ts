import type { Response } from 'express';

import type { ApiResponse, PaginationMeta } from '@logx/shared';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiResponse<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode = 200
): Response {
  const body: ApiResponse<T[]> = { success: true, data, meta };
  return res.status(statusCode).json(body);
}

export function sendError(res: Response, message: string, statusCode = 400): Response {
  const body: ApiResponse = { success: false, error: message };
  return res.status(statusCode).json(body);
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
