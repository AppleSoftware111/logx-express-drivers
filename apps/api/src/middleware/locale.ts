import type { NextFunction, Request, Response } from 'express';

import { DEFAULT_LOCALE, resolveLocaleFromAcceptLanguage } from '@logx/i18n';

export function localeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.locale = resolveLocaleFromAcceptLanguage(req.headers['accept-language']);
  if (!req.locale) {
    req.locale = DEFAULT_LOCALE;
  }
  next();
}
