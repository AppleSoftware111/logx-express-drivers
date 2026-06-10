import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

import {
  ApiErrorCode,
  getApiErrorMessage,
  translateValidationKey,
  type SupportedLocale,
} from '@logx/i18n';
import { POD_MAX_FILE_SIZE_BYTES } from '@logx/shared';

import { env } from '../config/env';
import { sendError } from '../utils/apiResponse';

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly params?: Record<string, string | number>;

  constructor(
    code: ApiErrorCode,
    statusCode = 500,
    params?: Record<string, string | number>,
    isOperational = true
  ) {
    super(code);
    this.code = code;
    this.statusCode = statusCode;
    this.params = params;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

function localizeValidationDetails(
  details: Record<string, string[] | undefined>,
  locale: SupportedLocale
): Record<string, string[] | undefined> {
  const out: Record<string, string[] | undefined> = {};
  for (const [field, messages] of Object.entries(details)) {
    out[field] = messages?.map((msg) =>
      msg.startsWith('validation.') ? translateValidationKey(locale, msg) : msg
    );
  }
  return out;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const locale = req.locale ?? 'pt';

  if (err instanceof ZodError) {
    sendError(
      res,
      {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: getApiErrorMessage(ApiErrorCode.VALIDATION_ERROR, locale),
      },
      400,
      {
        fields: localizeValidationDetails(err.flatten().fieldErrors, locale),
      }
    );
    return;
  }

  if (err instanceof AppError) {
    sendError(
      res,
      {
        code: err.code,
        message: getApiErrorMessage(err.code, locale, err.params),
      },
      err.statusCode
    );
    return;
  }

  if (err instanceof MulterError) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const code =
      err.code === 'LIMIT_FILE_SIZE'
        ? ApiErrorCode.POD_FILE_TOO_LARGE
        : ApiErrorCode.VALIDATION_ERROR;
    const params =
      err.code === 'LIMIT_FILE_SIZE'
        ? { maxSizeMb: Math.round(POD_MAX_FILE_SIZE_BYTES / (1024 * 1024)) }
        : undefined;

    sendError(
      res,
      {
        code,
        message: getApiErrorMessage(code, locale, params),
      },
      statusCode
    );
    return;
  }

  if (err instanceof Error && err.name === 'CastError') {
    sendError(
      res,
      {
        code: ApiErrorCode.INVALID_ID,
        message: getApiErrorMessage(ApiErrorCode.INVALID_ID, locale),
      },
      400
    );
    return;
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    sendError(
      res,
      {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: err.message,
      },
      400
    );
    return;
  }

  if (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === '11000'
  ) {
    sendError(
      res,
      {
        code: ApiErrorCode.DUPLICATE_KEY,
        message: getApiErrorMessage(ApiErrorCode.DUPLICATE_KEY, locale),
      },
      409
    );
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[error]', err);

  sendError(
    res,
    {
      code: ApiErrorCode.INTERNAL_ERROR,
      message:
        env.NODE_ENV === 'production'
          ? getApiErrorMessage(ApiErrorCode.INTERNAL_ERROR, locale)
          : message,
    },
    500
  );
}
