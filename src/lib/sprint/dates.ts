/**
 * Sprint and snapshot dates are calendar days ("2026-10-05"), stored as UTC
 * midnight so they never shift with the viewer's time zone.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-05" → Date at UTC midnight, or null if it isn't a real calendar day. */
export function parseDay(text: string): Date | null {
  if (!ISO_DAY.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || toDay(date) !== text ? null : date;
}

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date at UTC midnight → "5 Oct 2026". */
export function formatDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export type DateCheck<T> = ({ ok: true } & T) | { ok: false; errors: Record<string, string> };

/** S-1: both dates required, end after start. */
export function validateSprintDates(start: string, end: string): DateCheck<{ startDate: Date; endDate: Date }> {
  const startDate = parseDay(start);
  const endDate = parseDay(end);
  const errors: Record<string, string> = {};
  if (!startDate) errors.startDate = "Enter a start date.";
  if (!endDate) errors.endDate = "Enter an end date.";
  if (startDate && endDate && endDate <= startDate) errors.endDate = "The end date must be after the start date.";
  if (!startDate || !endDate || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, startDate, endDate };
}

/**
 * A snapshot's "as of" date must fall within the sprint and not before the
 * previous snapshot (the same day is allowed: a team may re-plan twice in a day).
 */
export function validateSnapshotDate(
  asOf: string,
  sprint: { startDate: Date; endDate: Date },
  previous: Date | null,
): DateCheck<{ asOfDate: Date }> {
  const fail = (message: string) => ({ ok: false as const, errors: { asOfDate: message } });
  const asOfDate = parseDay(asOf);
  if (!asOfDate) return fail("Enter the date this snapshot is from.");
  if (asOfDate < sprint.startDate || asOfDate > sprint.endDate) {
    return fail(`The date must be within the sprint (${formatDay(sprint.startDate)} to ${formatDay(sprint.endDate)}).`);
  }
  if (previous && asOfDate < previous) {
    return fail(`The date can't be before the previous snapshot (${formatDay(previous)}).`);
  }
  return { ok: true, asOfDate };
}

/** Today's calendar day in the viewer's own time zone, for form defaults. */
export function localToday(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
