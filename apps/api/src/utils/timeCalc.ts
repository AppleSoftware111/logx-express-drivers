import { env } from '../config/env';

/**
 * Calculate waiting time in whole minutes between two timestamps.
 * This is the canonical implementation — used whenever waitingTimeMinutes is stored.
 */
export function calcWaitingMinutes(arrivedAt: Date, completedAt: Date): number {
  return Math.round((completedAt.getTime() - arrivedAt.getTime()) / 60_000);
}

/**
 * Calculate delay in minutes: how many minutes past the scheduled start time.
 * Returns 0 if execution has not yet started and is not late.
 */
export function calcDelayMinutes(
  scheduledDate: Date | string,
  scheduledTime: string,
  referenceTime = new Date()
): number {
  const scheduled = buildScheduledDateTime(scheduledDate, scheduledTime);
  const diffMs = referenceTime.getTime() - scheduled.getTime();
  return Math.max(0, Math.floor(diffMs / 60_000));
}

/**
 * Build the full scheduled UTC Date object from a business date + "HH:mm" time string.
 */
export function buildScheduledDateTime(date: Date | string, time: string): Date {
  const businessDate = typeof date === "string" ? date : toDateString(date);
  const [year, month, day] = businessDate.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess);

  return new Date(utcGuess.getTime() - offset);
}

/**
 * Returns a YYYY-MM-DD string for a given Date (UTC).
 */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns true if `day` (0=Sun … 6=Sat) is in the daysOfWeek array.
 */
export function matchesDayOfWeek(date: Date, daysOfWeek: number[]): boolean {
  return daysOfWeek.includes(date.getUTCDay());
}

type RouteScheduleShape = {
  recurrenceType: string;
  daysOfWeek?: number[];
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  recurrenceStartDate?: Date | string | null;
  recurrenceEndDate?: Date | string | null;
};

export function routeRunsOnDate(route: RouteScheduleShape, date: Date | string): boolean {
  const targetDate = typeof date === 'string' ? date : toDateString(date);
  const { dayOfWeek, dayOfMonth, monthOfYear } = getBusinessDateParts(targetDate);
  const startDate = normalizeStoredBusinessDate(route.recurrenceStartDate);
  const endDate = normalizeStoredBusinessDate(route.recurrenceEndDate);

  if (startDate && targetDate < startDate) return false;
  if (endDate && targetDate > endDate) return false;

  switch (route.recurrenceType) {
    case 'DAILY':
      return true;
    case 'WEEKLY':
    case 'CUSTOM':
      return (route.daysOfWeek ?? []).includes(dayOfWeek);
    case 'MONTHLY':
      return (route.dayOfMonth ?? null) === dayOfMonth;
    case 'YEARLY':
      return (
        (route.dayOfMonth ?? null) === dayOfMonth &&
        (route.monthOfYear ?? null) === monthOfYear
      );
    default:
      return false;
  }
}

function getDateTimeFormatter() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function getClockParts(date: Date) {
  const parts = getDateTimeFormatter().formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;

  return values;
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = getClockParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

function normalizeStoredBusinessDate(value?: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return toDateString(new Date(value));
}

export function getCurrentBusinessDateString(now = new Date()): string {
  const parts = getClockParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getCurrentBusinessDate(): Date {
  return businessDateStringToUtcDate(getCurrentBusinessDateString());
}

export function businessDateStringToUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addBusinessDays(date: string, days: number): string {
  const next = businessDateStringToUtcDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateString(next);
}

export function getBusinessDateParts(date: string) {
  const normalized = businessDateStringToUtcDate(date);
  return {
    year: normalized.getUTCFullYear(),
    monthOfYear: normalized.getUTCMonth() + 1,
    dayOfMonth: normalized.getUTCDate(),
    dayOfWeek: normalized.getUTCDay(),
  };
}
