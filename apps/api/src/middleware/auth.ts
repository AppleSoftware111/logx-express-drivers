import type { NextFunction, Request, Response } from 'express';

import { AppError } from './errorHandler';
import { verifyAccessToken } from '../utils/jwtHelpers';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Access token missing', 401));
  }

  const token = authHeader.slice(7);

  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(new AppError('Invalid or expired access token', 401));
  }

  req.user = {
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role,
    driverId: payload.driverId,
    clientId: payload.clientId,
  };

  next();
}
