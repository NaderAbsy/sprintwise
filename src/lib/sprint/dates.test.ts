import { describe, expect, it } from "vitest";
import { formatDay, parseDay, validateSnapshotDate, validateSprintDates } from "@/lib/sprint/dates";

const day = (text: string) => parseDay(text)!;
const sprint = { startDate: day("2026-10-05"), endDate: day("2026-10-16") };

describe("parseDay", () => {
  it("accepts real calendar days only", () => {
    expect(parseDay("2026-10-05")?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("5/10/2026")).toBeNull();
    expect(parseDay("")).toBeNull();
  });

  it("formats in UTC so the day never shifts", () => {
    expect(formatDay(day("2026-10-05"))).toBe("5 Oct 2026");
  });
});

describe("validateSprintDates (S-1)", () => {
  it("needs both dates", () => {
    expect(validateSprintDates("", "")).toEqual({
      ok: false,
      errors: { startDate: "Enter a start date.", endDate: "Enter an end date." },
    });
  });

  it("needs the end after the start", () => {
    expect(validateSprintDates("2026-10-05", "2026-10-05")).toEqual({
      ok: false,
      errors: { endDate: "The end date must be after the start date." },
    });
    expect(validateSprintDates("2026-10-05", "2026-10-16")).toEqual({ ok: true, ...sprint });
  });
});

describe("validateSnapshotDate", () => {
  it("must fall within the sprint, inclusive", () => {
    expect(validateSnapshotDate("2026-10-05", sprint, null)).toEqual({ ok: true, asOfDate: day("2026-10-05") });
    expect(validateSnapshotDate("2026-10-16", sprint, null)).toEqual({ ok: true, asOfDate: day("2026-10-16") });
    expect(validateSnapshotDate("2026-10-17", sprint, null)).toEqual({ ok: false, errors: { asOfDate: "The date must be within the sprint (5 Oct 2026 to 16 Oct 2026)." } });
  });

  it("can't be before the previous snapshot, but can be the same day", () => {
    const previous = day("2026-10-08");
    expect(validateSnapshotDate("2026-10-07", sprint, previous)).toEqual({ ok: false, errors: { asOfDate: "The date can't be before the previous snapshot (8 Oct 2026)." } });
    expect(validateSnapshotDate("2026-10-08", sprint, previous)).toEqual({ ok: true, asOfDate: previous });
  });

  it("needs a date", () => {
    expect(validateSnapshotDate("", sprint, null)).toEqual({ ok: false, errors: { asOfDate: "Enter the date this snapshot is from." } });
  });
});
