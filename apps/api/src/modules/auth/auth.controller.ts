import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import {
  getMeService,
  loginService,
  logoutService,
  refreshTokenService,
} from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('strict' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const result = await loginService(email, password);

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

  return sendSuccess(res, {
    accessToken: result.accessToken,
    user: result.user,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token: string | undefined =
    req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Refresh token not provided' });
  }

  const tokens = await refreshTokenService(token);

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, cookieOptions);

  return sendSuccess(res, { accessToken: tokens.accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];
  const userId = req.user!.userId;

  await logoutService(userId, token);

  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getMeService(req.user!.userId);
  return sendSuccess(res, user);
});
