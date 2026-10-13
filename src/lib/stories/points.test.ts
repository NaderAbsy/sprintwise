import { describe, expect, it } from "vitest";
import { isEpic, isSubtask, parsePoints } from "@/lib/stories/types";

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
