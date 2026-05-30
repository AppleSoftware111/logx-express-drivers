import { getDelayLabel as getDelayLabelI18n, type SupportedLocale } from '@logx/i18n';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, format = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return format
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', String(year))
    .replace('HH', hours)
    .replace('mm', minutes);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function getDelayColor(delayMinutes: number): string {
  if (delayMinutes >= 60) return 'text-red-600 bg-red-50';
  if (delayMinutes >= 30) return 'text-orange-600 bg-orange-50';
  if (delayMinutes >= 15) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}

export function getDelayLabel(delayMinutes: number, locale: SupportedLocale = 'pt'): string {
  return getDelayLabelI18n(delayMinutes, locale);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    ASSIGNED: 'bg-blue-100 text-blue-700',
    ACCEPTED: 'bg-indigo-100 text-indigo-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    ARRIVED: 'bg-cyan-100 text-cyan-700',
    SKIPPED: 'bg-gray-100 text-gray-500',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-700';
}
