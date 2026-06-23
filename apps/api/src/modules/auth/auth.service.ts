import bcrypt from 'bcryptjs';

import { ApiErrorCode, type SupportedLocale } from '@logx/i18n';
import { BCRYPT_ROUNDS } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { User } from '../../models/User.model';
import {
  getRefreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from '../../utils/jwtHelpers';
import { resolveDriverIdForUser } from '../../utils/resolveDriverId';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    role: string;
    locale: SupportedLocale;
    companyId?: string;
    driverId?: string;
    clientId?: string;
  };
}

export interface UpdateUserPreferencesInput {
  locale?: SupportedLocale;
}

async function buildTokenPayload(user: {
  _id: { toString(): string };
  companyId?: { toString(): string } | null;
  role: string;
  driverId?: { toString(): string } | null;
  clientId?: { toString(): string } | null;
}): Promise<JwtPayload> {
  const driverId = await resolveDriverIdForUser(user);

  return {
    userId: user._id.toString(),
    companyId: user.companyId?.toString() ?? '',
    role: user.role,
    driverId,
    clientId: user.clientId?.toString(),
  };
}

export async function loginService(
  email: string,
  password: string,
  locale?: SupportedLocale
): Promise<LoginResult> {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash +refreshTokens'
  );

  if (!user || !user.isActive) {
    throw new AppError(ApiErrorCode.AUTH_INVALID_CREDENTIALS, 401);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(ApiErrorCode.AUTH_INVALID_CREDENTIALS, 401);
  }

  const tokenPayload = await buildTokenPayload(user);

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Prune expired tokens and append new one
  const now = new Date();
  const validTokens = user.refreshTokens.filter((t) => t.expiresAt > now);
  validTokens.push({ token: refreshToken, expiresAt: getRefreshTokenExpiry() });

  await User.findByIdAndUpdate(user._id, {
    $set: {
      refreshTokens: validTokens,
      ...(locale ? { locale, localeUpdatedAt: new Date() } : {}),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      locale: locale ?? user.locale,
      companyId: user.companyId?.toString(),
      driverId: tokenPayload.driverId,
      clientId: user.clientId?.toString(),
    },
  };
}

export async function refreshTokenService(
  refreshToken: string,
  locale?: SupportedLocale
): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throw new AppError(ApiErrorCode.AUTH_REFRESH_INVALID, 401);
  }

  const user = await User.findById(payload.userId).select('+refreshTokens');
  if (!user || !user.isActive) {
    throw new AppError(ApiErrorCode.AUTH_USER_INACTIVE, 401);
  }

  const now = new Date();
  const tokenRecord = user.refreshTokens.find(
    (t) => t.token === refreshToken && t.expiresAt > now
  );

  if (!tokenRecord) {
    // Possible token reuse attack — invalidate all sessions
    await User.findByIdAndUpdate(user._id, { $set: { refreshTokens: [] } });
    throw new AppError(ApiErrorCode.AUTH_REFRESH_REUSE, 401);
  }

  const newTokenPayload = await buildTokenPayload(user);

  const newAccessToken = signAccessToken(newTokenPayload);
  const newRefreshToken = signRefreshToken(newTokenPayload);

  // Rotate: remove old, add new
  const updatedTokens = user.refreshTokens
    .filter((t) => t.token !== refreshToken && t.expiresAt > now)
    .concat({ token: newRefreshToken, expiresAt: getRefreshTokenExpiry() });

  await User.findByIdAndUpdate(user._id, {
    $set: {
      refreshTokens: updatedTokens,
      ...(locale ? { locale, localeUpdatedAt: new Date() } : {}),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutService(
  userId: string,
  refreshToken: string | undefined
): Promise<void> {
  if (!refreshToken) return;

  await User.findByIdAndUpdate(userId, {
    $pull: { refreshTokens: { token: refreshToken } },
  });
}

export async function getMeService(userId: string) {
  const user = await User.findById(userId)
    .select('-passwordHash -refreshTokens')
    .populate('companyId', 'name logo')
    .lean();

  if (!user) {
    throw new AppError(ApiErrorCode.USER_NOT_FOUND, 404);
  }

  await resolveDriverIdForUser(user);

  const refreshedUser = await User.findById(userId)
    .select('-passwordHash -refreshTokens')
    .populate('companyId', 'name logo')
    .lean();

  if (!refreshedUser) {
    throw new AppError(ApiErrorCode.USER_NOT_FOUND, 404);
  }

  return refreshedUser;
}

export async function updateUserPreferencesService(
  userId: string,
  input: UpdateUserPreferencesInput
) {
  const updates: Record<string, unknown> = {};

  if (input.locale) {
    updates.locale = input.locale;
    updates.localeUpdatedAt = new Date();
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true }
  )
    .select('-passwordHash -refreshTokens')
    .populate('companyId', 'name logo')
    .lean();

  if (!user) {
    throw new AppError(ApiErrorCode.USER_NOT_FOUND, 404);
  }

  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
