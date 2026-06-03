import { ApiErrorCode, getApiErrorMessage } from '@logx/i18n';
import rateLimit from 'express-rate-limit';

import { sendError } from '../utils/apiResponse';

function buildLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const locale = req.locale ?? 'pt';
      sendError(
        res,
        {
          code: ApiErrorCode.RATE_LIMITED,
          message: getApiErrorMessage(ApiErrorCode.RATE_LIMITED, locale),
        },
        429
      );
    },
  });
}

export const authLimiter = buildLimiter(15 * 60 * 1000, 20);
export const generalLimiter = buildLimiter(60 * 1000, 200);
export const uploadLimiter = buildLimiter(60 * 1000, 30);
