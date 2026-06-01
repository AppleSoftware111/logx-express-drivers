import type { NextFunction, Request, Response } from 'express';

import { ApiErrorCode } from '@logx/i18n';

import { User } from '../models/User.model';
import { verifyAccessToken } from '../utils/jwtHelpers';
import { AppError } from './errorHandler';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(ApiErrorCode.AUTH_TOKEN_MISSING, 401));
  }

  const token = authHeader.slice(7);

  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(new AppError(ApiErrorCode.AUTH_TOKEN_EXPIRED, 401));
  }

  req.user = {
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role,
    driverId: payload.driverId,
    clientId: payload.clientId,
  };

  if (req.locale) {
    void User.updateOne(
      { _id: payload.userId, locale: { $ne: req.locale } },
      { $set: { locale: req.locale } }
    ).catch(() => {
      // Locale sync should never block authenticated requests.
    });
  }

  next();
}
