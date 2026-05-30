import type { NextFunction, Request, Response } from 'express';

import { ApiErrorCode } from '@logx/i18n';
import type { UserRole } from '@logx/shared';

import { AppError } from './errorHandler';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(ApiErrorCode.AUTH_NOT_AUTHENTICATED, 401));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(new AppError(ApiErrorCode.INSUFFICIENT_PERMISSIONS, 403));
    }

    next();
  };
}

export function requireCompanyMatch(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(ApiErrorCode.AUTH_NOT_AUTHENTICATED, 401));
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const companyIdParam = req.params.companyId;
  if (companyIdParam && companyIdParam !== req.user.companyId) {
    return next(new AppError(ApiErrorCode.COMPANY_ACCESS_DENIED, 403));
  }

  next();
}
