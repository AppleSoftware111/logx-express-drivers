import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  if (err instanceof Error && err.name === 'CastError') {
    res.status(400).json({ success: false, error: 'Invalid ID format' });
    return;
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    res.status(400).json({ success: false, error: err.message });
    return;
  }

  // MongoDB duplicate key
  if (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === '11000'
  ) {
    res.status(409).json({ success: false, error: 'A record with that value already exists' });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[error]', err);

  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : message,
  });
}
