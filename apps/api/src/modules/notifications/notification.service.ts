import axios from 'axios';

import { DEFAULT_LOCALE, formatMessage, type SupportedLocale } from '@logx/i18n';

import { env } from '../../config/env';

export interface NotificationDeliveryResult {
  success: boolean;
  provider: 'zapi' | 'twilio';
  skipped?: boolean;
  externalMessageId?: string;
  error?: string;
}

async function sendViaZApi(phone: string, message: string): Promise<NotificationDeliveryResult> {
  if (!env.ZAPI_INSTANCE_ID || !env.ZAPI_TOKEN) {
    console.warn('[notifications] Z-API credentials not configured');
    return {
      success: false,
      provider: 'zapi',
      skipped: true,
      error: 'Z-API credentials not configured',
    };
  }

  const response = await axios.post(
    `https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`,
    { phone, message },
    { timeout: 10_000 }
  );

  return {
    success: true,
    provider: 'zapi',
    externalMessageId:
      response.data?.zaapId ?? response.data?.id ?? response.data?.messageId,
  };
}

async function sendViaTwilio(phone: string, message: string): Promise<NotificationDeliveryResult> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    console.warn('[notifications] Twilio credentials not configured');
    return {
      success: false,
      provider: 'twilio',
      skipped: true,
      error: 'Twilio credentials not configured',
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: env.TWILIO_WHATSAPP_FROM,
    To: `whatsapp:${phone}`,
    Body: message,
  });

  const response = await axios.post(url, params.toString(), {
    auth: {
      username: env.TWILIO_ACCOUNT_SID,
      password: env.TWILIO_AUTH_TOKEN,
    },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10_000,
  });

  return {
    success: true,
    provider: 'twilio',
    externalMessageId: response.data?.sid,
  };
}

export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<NotificationDeliveryResult> {
  try {
    const provider = env.WHATSAPP_PROVIDER === 'twilio' ? 'twilio' : 'zapi';
    const result =
      provider === 'twilio'
        ? await sendViaTwilio(phone, message)
        : await sendViaZApi(phone, message);

    if (env.WHATSAPP_PROVIDER === 'twilio') {
      console.info(`[notifications] WhatsApp ${result.success ? 'sent' : 'failed'} via Twilio to ${phone}`);
    } else {
      console.info(`[notifications] WhatsApp ${result.success ? 'sent' : 'failed'} via Z-API to ${phone}`);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] WhatsApp send failed: ${msg}`);
    return {
      success: false,
      provider: env.WHATSAPP_PROVIDER === 'twilio' ? 'twilio' : 'zapi',
      error: msg,
    };
  }
}

function formatTemplate(
  locale: SupportedLocale,
  key: string,
  params: Record<string, string | number>
): string {
  return formatMessage(locale, 'notifications', key, params);
}

export function buildRouteAssignedMessage(
  driverName: string,
  routeName: string,
  time: string,
  locale: SupportedLocale = DEFAULT_LOCALE
): string {
  return formatTemplate(locale, 'routeAssigned', { driverName, routeName, time });
}

export function buildDelayAlertMessage(
  routeName: string,
  delayMinutes: number,
  locale: SupportedLocale = DEFAULT_LOCALE
): string {
  return formatTemplate(locale, 'delayWhatsApp', { routeName, minutes: delayMinutes });
}
