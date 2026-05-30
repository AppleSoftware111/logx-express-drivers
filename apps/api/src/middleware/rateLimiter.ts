import { ApiErrorCode } from '@logx/i18n';
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ApiErrorCode.RATE_LIMITED,
      message: 'Too many requests, please try again after 15 minutes',
    },
  },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ApiErrorCode.RATE_LIMITED,
      message: 'Rate limit exceeded, please slow down',
    },
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ApiErrorCode.RATE_LIMITED,
      message: 'Too many upload requests',
    },
  },
});
