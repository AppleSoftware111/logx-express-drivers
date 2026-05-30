import type { SupportedLocale } from './locales';

import ptAlerts from '../locales/pt/alerts.json';
import ptAuth from '../locales/pt/auth.json';
import ptClients from '../locales/pt/clients.json';
import ptCommon from '../locales/pt/common.json';
import ptDashboard from '../locales/pt/dashboard.json';
import ptDrivers from '../locales/pt/drivers.json';
import ptEnums from '../locales/pt/enums.json';
import ptErrors from '../locales/pt/errors.json';
import ptExecutions from '../locales/pt/executions.json';
import ptMetadata from '../locales/pt/metadata.json';
import ptMobile from '../locales/pt/mobile.json';
import ptNav from '../locales/pt/nav.json';
import ptNotifications from '../locales/pt/notifications.json';
import ptPortal from '../locales/pt/portal.json';
import ptReports from '../locales/pt/reports.json';
import ptRoutes from '../locales/pt/routes.json';
import ptSettings from '../locales/pt/settings.json';
import ptValidation from '../locales/pt/validation.json';

import esAlerts from '../locales/es/alerts.json';
import esAuth from '../locales/es/auth.json';
import esClients from '../locales/es/clients.json';
import esCommon from '../locales/es/common.json';
import esDashboard from '../locales/es/dashboard.json';
import esDrivers from '../locales/es/drivers.json';
import esEnums from '../locales/es/enums.json';
import esErrors from '../locales/es/errors.json';
import esExecutions from '../locales/es/executions.json';
import esMetadata from '../locales/es/metadata.json';
import esMobile from '../locales/es/mobile.json';
import esNav from '../locales/es/nav.json';
import esNotifications from '../locales/es/notifications.json';
import esPortal from '../locales/es/portal.json';
import esReports from '../locales/es/reports.json';
import esRoutes from '../locales/es/routes.json';
import esSettings from '../locales/es/settings.json';
import esValidation from '../locales/es/validation.json';

import enAlerts from '../locales/en/alerts.json';
import enAuth from '../locales/en/auth.json';
import enClients from '../locales/en/clients.json';
import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import enDrivers from '../locales/en/drivers.json';
import enEnums from '../locales/en/enums.json';
import enErrors from '../locales/en/errors.json';
import enExecutions from '../locales/en/executions.json';
import enMetadata from '../locales/en/metadata.json';
import enMobile from '../locales/en/mobile.json';
import enNav from '../locales/en/nav.json';
import enNotifications from '../locales/en/notifications.json';
import enPortal from '../locales/en/portal.json';
import enReports from '../locales/en/reports.json';
import enRoutes from '../locales/en/routes.json';
import enSettings from '../locales/en/settings.json';
import enValidation from '../locales/en/validation.json';

export type MessageNamespaces = {
  common: typeof ptCommon;
  auth: typeof ptAuth;
  nav: typeof ptNav;
  metadata: typeof ptMetadata;
  dashboard: typeof ptDashboard;
  drivers: typeof ptDrivers;
  clients: typeof ptClients;
  routes: typeof ptRoutes;
  executions: typeof ptExecutions;
  alerts: typeof ptAlerts;
  reports: typeof ptReports;
  portal: typeof ptPortal;
  settings: typeof ptSettings;
  validation: typeof ptValidation;
  enums: typeof ptEnums;
  errors: typeof ptErrors;
  mobile: typeof ptMobile;
  notifications: typeof ptNotifications;
};

const bundles: Record<SupportedLocale, MessageNamespaces> = {
  pt: {
    common: ptCommon,
    auth: ptAuth,
    nav: ptNav,
    metadata: ptMetadata,
    dashboard: ptDashboard,
    drivers: ptDrivers,
    clients: ptClients,
    routes: ptRoutes,
    executions: ptExecutions,
    alerts: ptAlerts,
    reports: ptReports,
    portal: ptPortal,
    settings: ptSettings,
    validation: ptValidation,
    enums: ptEnums,
    errors: ptErrors,
    mobile: ptMobile,
    notifications: ptNotifications,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    nav: esNav,
    metadata: esMetadata,
    dashboard: esDashboard,
    drivers: esDrivers,
    clients: esClients,
    routes: esRoutes,
    executions: esExecutions,
    alerts: esAlerts,
    reports: esReports,
    portal: esPortal,
    settings: esSettings,
    validation: esValidation,
    enums: esEnums,
    errors: esErrors,
    mobile: esMobile,
    notifications: esNotifications,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    nav: enNav,
    metadata: enMetadata,
    dashboard: enDashboard,
    drivers: enDrivers,
    clients: enClients,
    routes: enRoutes,
    executions: enExecutions,
    alerts: enAlerts,
    reports: enReports,
    portal: enPortal,
    settings: enSettings,
    validation: enValidation,
    enums: enEnums,
    errors: enErrors,
    mobile: enMobile,
    notifications: enNotifications,
  },
};

export function loadMessages(locale: SupportedLocale): MessageNamespaces {
  return bundles[locale];
}

/** Flatten for i18next single-namespace mode */
export function loadFlatMessages(locale: SupportedLocale): Record<string, unknown> {
  const ns = loadMessages(locale);
  return { ...ns };
}

export function getNestedMessage(
  locale: SupportedLocale,
  namespace: keyof MessageNamespaces,
  key: string
): string | undefined {
  const messages = loadMessages(locale)[namespace] as Record<string, unknown>;
  const parts = key.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as object)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function translateValidationKey(locale: SupportedLocale, key: string): string {
  const bare = key.replace(/^validation\./, '');
  const msg = getNestedMessage(locale, 'validation', bare);
  if (msg) return msg;
  const direct = (loadMessages(locale).validation as Record<string, string>)[bare];
  return direct ?? key;
}
