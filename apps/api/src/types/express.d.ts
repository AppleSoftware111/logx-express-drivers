import type { UserRole } from '@logx/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        companyId: string;
        role: UserRole | string;
        driverId?: string;
        clientId?: string;
      };
    }
  }
}

export {};
