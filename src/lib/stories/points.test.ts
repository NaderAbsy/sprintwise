import { describe, expect, it } from "vitest";
import { isEpic, isSubtask, normalizeKey, parsePoints } from "@/lib/stories/types";
import { cutText } from "@/lib/text";

describe("parsePoints", () => {
  it("reads a decimal comma as a decimal point", () => {
    expect(parsePoints("1,5")).toEqual({ points: 1.5, valid: true });
    expect(parsePoints(" 0,5 ")).toEqual({ points: 0.5, valid: true });
    expect(parsePoints("2.5")).toEqual({ points: 2.5, valid: true });
  });

  it("still rejects what isn't one number", () => {
    expect(parsePoints("1,000,5").valid).toBe(false);
    expect(parsePoints("-1").valid).toBe(false);
    expect(parsePoints("three").valid).toBe(false);
    expect(parsePoints("")).toEqual({ points: null, valid: true });
  });
});

describe("issue types left out by default", () => {
  it("knows epics and sub-tasks however Jira spells them", () => {
    expect(isEpic(" Epic ")).toBe(true);
    for (const type of ["Sub-task", "Subtask", "sub task", "SUB-TASK"]) expect(isSubtask(type)).toBe(true);
    for (const type of ["Story", "Task", "Bug", "", undefined]) expect(isSubtask(type)).toBe(false);
  });
});

describe("normalizeKey", () => {
  it("drops invisible characters copied along with a key", () => {
    expect(normalizeKey(" abc-1​")).toBe("ABC-1");
    expect(normalizeKey("‮ABC-2‎")).toBe("ABC-2");
    expect(normalizeKey("﻿mob-7")).toBe("MOB-7");
  });
});

describe("cutText", () => {
  it("never splits an emoji or a flag", () => {
    expect(cutText("Pay 💳 now", 5)).toBe("Pay ");
    expect(cutText("Pay 💳 now", 6)).toBe("Pay 💳");
    expect(cutText("🇦🇪🇦🇪", 5)).toBe("🇦🇪");
    expect(cutText("short", 60)).toBe("short");
  });
});
