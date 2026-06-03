import type { Response } from 'express';

import type {
  ApiErrorPayload,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
} from '@logx/shared';

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

export function sendError(
  res: Response,
  error: ApiErrorPayload | string,
  statusCode = 400,
  details?: Record<string, unknown>
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error:
      typeof error === 'string'
        ? { code: 'BAD_REQUEST', message: error }
        : error,
    ...(details ? { details } : {}),
  };
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
