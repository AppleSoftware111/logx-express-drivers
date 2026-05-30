import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  ApiErrorCode,
  getApiErrorMessage,
  translateValidationKey,
  type SupportedLocale,
} from '@logx/i18n';

import { env } from '../config/env';

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
    res.status(400).json({
      success: false,
      error: {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: getApiErrorMessage(ApiErrorCode.VALIDATION_ERROR, locale),
      },
      details: localizeValidationDetails(err.flatten().fieldErrors, locale),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: getApiErrorMessage(err.code, locale, err.params),
      },
    });
    return;
  }

  if (err instanceof Error && err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        code: ApiErrorCode.INVALID_ID,
        message: getApiErrorMessage(ApiErrorCode.INVALID_ID, locale),
      },
    });
    return;
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: err.message,
      },
    });
    return;
  }

  if (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === '11000'
  ) {
    res.status(409).json({
      success: false,
      error: {
        code: ApiErrorCode.DUPLICATE_KEY,
        message: getApiErrorMessage(ApiErrorCode.DUPLICATE_KEY, locale),
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[error]', err);

  res.status(500).json({
    success: false,
    error: {
      code: ApiErrorCode.INTERNAL_ERROR,
      message:
        env.NODE_ENV === 'production'
          ? getApiErrorMessage(ApiErrorCode.INTERNAL_ERROR, locale)
          : message,
    },
  });
}
