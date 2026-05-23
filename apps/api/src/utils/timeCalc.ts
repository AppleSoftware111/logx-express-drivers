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
export function calcDelayMinutes(scheduledDate: Date, scheduledTime: string): number {
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const scheduled = new Date(scheduledDate);
  scheduled.setUTCHours(hours, minutes, 0, 0);

  const now = new Date();
  const diffMs = now.getTime() - scheduled.getTime();
  return Math.max(0, Math.floor(diffMs / 60_000));
}

/**
 * Build the full scheduled Date object from a date + "HH:mm" time string (UTC).
 */
export function buildScheduledDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
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
