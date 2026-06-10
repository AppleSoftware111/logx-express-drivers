import type { SupportedLocale } from './locales';
import { getNestedMessage, loadMessages } from './messages';

export enum ApiErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_REFRESH_INVALID = 'AUTH_REFRESH_INVALID',
  AUTH_REFRESH_REUSE = 'AUTH_REFRESH_REUSE',
  AUTH_USER_INACTIVE = 'AUTH_USER_INACTIVE',
  AUTH_NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  COMPANY_ACCESS_DENIED = 'COMPANY_ACCESS_DENIED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  DRIVER_NOT_FOUND = 'DRIVER_NOT_FOUND',
  CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',
  STOP_NOT_FOUND = 'STOP_NOT_FOUND',
  VEHICLE_NOT_FOUND = 'VEHICLE_NOT_FOUND',
  BRANCH_NOT_FOUND = 'BRANCH_NOT_FOUND',
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  EMAIL_ALREADY_IN_USE = 'EMAIL_ALREADY_IN_USE',
  CNPJ_ALREADY_EXISTS = 'CNPJ_ALREADY_EXISTS',
  PLATE_ALREADY_EXISTS = 'PLATE_ALREADY_EXISTS',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ID = 'INVALID_ID',
  RATE_LIMITED = 'RATE_LIMITED',
  DRIVER_EMAIL_PASSWORD_REQUIRED = 'DRIVER_EMAIL_PASSWORD_REQUIRED',
  CLIENT_PORTAL_CREDENTIALS_REQUIRED = 'CLIENT_PORTAL_CREDENTIALS_REQUIRED',
  CONTRACT_END_BEFORE_START = 'CONTRACT_END_BEFORE_START',
  EXECUTION_CANNOT_SUBSTITUTE = 'EXECUTION_CANNOT_SUBSTITUTE',
  STOP_ALREADY_STATUS = 'STOP_ALREADY_STATUS',
  STOP_MUST_BE_ARRIVED = 'STOP_MUST_BE_ARRIVED',
  STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS = 'STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS',
  POD_FILE_REQUIRED = 'POD_FILE_REQUIRED',
  POD_FILE_TOO_LARGE = 'POD_FILE_TOO_LARGE',
  POD_FILE_INVALID_TYPE = 'POD_FILE_INVALID_TYPE',
  POD_UPLOAD_FAILED = 'POD_UPLOAD_FAILED',
  POD_KEY_REQUIRED = 'POD_KEY_REQUIRED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export type ApiErrorParams = Record<string, string | number>;

export function getApiErrorMessage(
  code: ApiErrorCode,
  locale: SupportedLocale,
  params?: ApiErrorParams
): string {
  const messages = loadMessages(locale);
  const errors = messages.errors as Record<string, string>;
  let template = errors[code] ?? errors.INTERNAL_ERROR ?? code;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }

  return template;
}

/** Resolve API error from response body (code or legacy string) */
export function resolveApiErrorMessage(
  body: { error?: string | { code?: string; message?: string }; code?: string },
  locale: SupportedLocale
): string {
  const err = body.error;
  if (typeof err === 'object' && err?.code) {
    const code = err.code as ApiErrorCode;
    if (Object.values(ApiErrorCode).includes(code)) {
      return getApiErrorMessage(code, locale);
    }
    return err.message ?? code;
  }
  if (typeof err === 'string') {
    if (Object.values(ApiErrorCode).includes(err as ApiErrorCode)) {
      return getApiErrorMessage(err as ApiErrorCode, locale);
    }
    return err;
  }
  return getApiErrorMessage(ApiErrorCode.INTERNAL_ERROR, locale);
}

export { getNestedMessage };
