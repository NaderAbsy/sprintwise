/** One step of the sign-up funnel: how many accounts reached it, and what share of the step before. */
export type FunnelStep = { label: string; hint: string; count: number; ofPrevious: number | null };

/** Turns counts into steps; the share is null for the first step, or when the step before has no one. */
export function funnel(rows: { label: string; hint: string; count: number }[]): FunnelStep[] {
  return rows.map((row, i) => {
    const previous = i === 0 ? null : rows[i - 1].count;
    return { ...row, ofPrevious: previous ? row.count / previous : null };
  });
}

/** Monday-start weeks, oldest first, counting the dates that fall in each. */
export function weeklyCounts(dates: Date[], now: Date, weeks = 8): { weekOf: Date; count: number }[] {
  const day = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * day;
  const starts = Array.from({ length: weeks }, (_, i) => monday - (weeks - 1 - i) * 7 * day);
  return starts.map((start) => ({
    weekOf: new Date(start),
    count: dates.filter((d) => d.getTime() >= start && d.getTime() < start + 7 * day).length,
  }));
}
