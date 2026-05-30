import type { SupportedLocale } from '@logx/i18n';

declare global {
  namespace Express {
    interface Request {
      locale: SupportedLocale;
      user?: {
        userId: string;
        companyId: string;
        role: string;
        driverId?: string;
        clientId?: string;
      };
    }
  }
}

export {};
