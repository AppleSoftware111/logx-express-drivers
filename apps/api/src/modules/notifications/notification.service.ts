import axios from 'axios';

import { env } from '../../config/env';

async function sendViaZApi(phone: string, message: string): Promise<void> {
  if (!env.ZAPI_INSTANCE_ID || !env.ZAPI_TOKEN) {
    console.warn('[notifications] Z-API credentials not configured');
    return;
  }

  await axios.post(
    `https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`,
    { phone, message },
    { timeout: 10_000 }
  );
}

async function sendViaTwilio(phone: string, message: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    console.warn('[notifications] Twilio credentials not configured');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: env.TWILIO_WHATSAPP_FROM,
    To: `whatsapp:${phone}`,
    Body: message,
  });

  await axios.post(url, params.toString(), {
    auth: {
      username: env.TWILIO_ACCOUNT_SID,
      password: env.TWILIO_AUTH_TOKEN,
    },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10_000,
  });
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  try {
    if (env.WHATSAPP_PROVIDER === 'twilio') {
      await sendViaTwilio(phone, message);
    } else {
      await sendViaZApi(phone, message);
    }
    console.info(`[notifications] WhatsApp sent to ${phone}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] WhatsApp send failed: ${msg}`);
  }
}

export function buildRouteAssignedMessage(driverName: string, routeName: string, time: string): string {
  return `Olá ${driverName}! Você tem uma rota atribuída hoje: *${routeName}* com saída às *${time}*. Acesse o app para ver os detalhes. - LOGX Express`;
}

export function buildDelayAlertMessage(routeName: string, delayMinutes: number): string {
  return `⚠️ ALERTA: A rota *${routeName}* está com *${delayMinutes} minutos* de atraso. - LOGX Express`;
}
