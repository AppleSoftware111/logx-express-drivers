import type { SupportedLocale } from '@logx/i18n';
import { formatMessage } from '@logx/i18n';
import type { AlertType } from '@logx/shared';

import { Alert, type IAlert } from '../../models/Alert.model';

type AlertMessageParams = Record<string, string | number>;

function localizeAlertMessage(
  alert: Pick<IAlert, 'message' | 'messageKey' | 'messageParams'>,
  locale: SupportedLocale
) {
  if (!alert.messageKey) return alert.message;
  return formatMessage(
    locale,
    'notifications',
    alert.messageKey,
    alert.messageParams as AlertMessageParams | undefined,
    alert.message
  );
}

export async function listAlerts(
  companyId: string,
  filters: { isRead?: boolean; type?: AlertType },
  page: number,
  limit: number,
  locale: SupportedLocale
) {
  const query: Record<string, unknown> = { companyId };
  if (filters.isRead !== undefined) query.isRead = filters.isRead;
  if (filters.type) query.type = filters.type;

  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    Alert.find(query)
      .select('-__v')
      .populate('executionId', 'scheduledDate scheduledTime routeId driverId')
      .lean()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Alert.countDocuments(query),
  ]);

  return {
    alerts: alerts.map((alert) => ({
      ...alert,
      message: localizeAlertMessage(alert as IAlert, locale),
    })),
    total,
  };
}

export async function markAlertRead(companyId: string, alertId: string) {
  return Alert.findOneAndUpdate(
    { companyId, _id: alertId },
    { isRead: true },
    { new: true }
  ).lean();
}

export async function markAllAlertsRead(companyId: string) {
  return Alert.updateMany({ companyId, isRead: false }, { isRead: true });
}

export async function createAlert(
  companyId: string,
  executionId: string,
  type: AlertType,
  message: string,
  messageKey?: string,
  messageParams?: AlertMessageParams
): Promise<string> {
  const alert = await Alert.create({
    companyId,
    executionId,
    type,
    message,
    messageKey: messageKey ?? null,
    messageParams: messageParams ?? null,
  });
  return alert._id.toString();
}

export async function alertAlreadyExists(
  executionId: string,
  type: AlertType
): Promise<boolean> {
  const count = await Alert.countDocuments({ executionId, type });
  return count > 0;
}

export async function getUnreadCount(companyId: string): Promise<number> {
  return Alert.countDocuments({ companyId, isRead: false });
}

export function localizeAlertDocument<T extends Pick<IAlert, 'message' | 'messageKey' | 'messageParams'>>(
  alert: T,
  locale: SupportedLocale
): T & { message: string } {
  return {
    ...alert,
    message: localizeAlertMessage(alert as IAlert, locale),
  };
}
