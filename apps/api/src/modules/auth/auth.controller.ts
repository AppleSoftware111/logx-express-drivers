import type { Request, Response } from 'express';

import { ApiErrorCode } from '@logx/i18n';
import type { UpdateUserPreferencesInput } from '@logx/shared';

import { asyncHandler } from '../../middleware/asyncHandler';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/apiResponse';
import {
  getMeService,
  loginService,
  logoutService,
  refreshTokenService,
  updateUserPreferencesService,
} from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const result = await loginService(email, password, req.locale);

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

  return sendSuccess(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token: string | undefined =
    req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;

  if (!token) {
    throw new AppError(ApiErrorCode.AUTH_TOKEN_MISSING, 401);
  }

  const tokens = await refreshTokenService(token, req.locale);

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, cookieOptions);

  return sendSuccess(res, { accessToken: tokens.accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token: string | undefined =
    req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
  const userId = req.user!.userId;

  await logoutService(userId, token);

  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

  return sendSuccess(res, { success: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getMeService(req.user!.userId);
  return sendSuccess(res, user);
});

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateUserPreferencesService(
    req.user!.userId,
    req.body as UpdateUserPreferencesInput
  );
  return sendSuccess(res, user);
});
