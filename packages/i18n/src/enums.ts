import type { SupportedLocale } from './locales';
import { getNestedMessage } from './messages';

function enumLabel(
  locale: SupportedLocale,
  group: string,
  value: string
): string {
  return getNestedMessage(locale, 'enums', `${group}.${value}`) ?? value;
}

export function getUserRoleLabel(role: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'userRole', role);
}

export function getVehicleTypeLabel(type: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'vehicleType', type);
}

export function getClientTypeLabel(type: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'clientType', type);
}

export function getRecurrenceTypeLabel(type: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'recurrenceType', type);
}

export function getRouteStopTypeLabel(type: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'routeStopType', type);
}

export function getExecutionStatusLabel(status: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'executionStatus', status);
}

export function getStopStatusLabel(status: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'stopStatus', status);
}

export function getAlertTypeLabel(type: string, locale: SupportedLocale): string {
  return enumLabel(locale, 'alertType', type);
}

export function getDelayLabel(minutes: number, locale: SupportedLocale): string {
  if (minutes >= 60) {
    return getNestedMessage(locale, 'alerts', 'delay60') ?? `${minutes} min`;
  }
  if (minutes >= 30) {
    return getNestedMessage(locale, 'alerts', 'delay30') ?? `${minutes} min`;
  }
  if (minutes >= 15) {
    return getNestedMessage(locale, 'alerts', 'delay15') ?? `${minutes} min`;
  }
  return getNestedMessage(locale, 'alerts', 'onTime') ?? 'On time';
}
