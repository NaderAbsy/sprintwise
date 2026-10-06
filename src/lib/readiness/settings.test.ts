import { describe, expect, it } from "vitest";
import { DEFAULT_VAGUE_WORDS, scoreStory } from "@/lib/readiness/rules";
import {
  DEFAULT_RULE_SETTINGS,
  isDefault,
  parseCustomChecks,
  parseDoneStatuses,
  parseRuleSettings,
  readCustomChecks,
  SETTINGS_LIMITS,
} from "@/lib/readiness/settings";
import { story } from "@/test/story";

describe("parseRuleSettings (R-6)", () => {
  it("accepts one word per line or comma-separated, trimmed, lower-cased and de-duplicated", () => {
    expect(parseRuleSettings(" 5 ", "Fast, easy\n  Seamless  \nfast\n\n as   needed ")).toEqual({
      ok: true,
      settings: { maxPoints: 5, vagueWords: ["fast", "easy", "seamless", "as needed"] },
    });
  });

  it("allows an empty word list", () => {
    expect(parseRuleSettings("8", "  ")).toEqual({ ok: true, settings: { maxPoints: 8, vagueWords: [] } });
  });

  it("rejects max points that aren't a whole number from 1 to 100", () => {
    for (const bad of ["0", "101", "3.5", "", "eight"]) {
      expect(parseRuleSettings(bad, "fast")).toMatchObject({ ok: false, errors: { maxPoints: expect.any(String) } });
    }
  });

  it("rejects oversized words and lists", () => {
    expect(parseRuleSettings("8", "x".repeat(41))).toMatchObject({ ok: false, errors: { vagueWords: expect.stringMatching(/too long/) } });
    const many = Array.from({ length: 101 }, (_, i) => `word${i}`).join("\n");
    expect(parseRuleSettings("8", many)).toMatchObject({ ok: false, errors: { vagueWords: expect.stringMatching(/100 words/) } });
  });

  it("recognises the defaults", () => {
    expect(isDefault(DEFAULT_RULE_SETTINGS)).toBe(true);
    expect(isDefault({ maxPoints: 5, vagueWords: DEFAULT_VAGUE_WORDS })).toBe(false);
  });

  it("changes scores the way the rules say", () => {
    const fiveFast = story({ storyPoints: 5, title: "Make it fast" });
    expect(scoreStory(fiveFast, DEFAULT_RULE_SETTINGS).score).toBe(90); // "fast" is vague by default
    const relaxed = parseRuleSettings("3", "slow");
    if (!relaxed.ok) throw new Error("expected valid settings");
    const r = scoreStory(fiveFast, relaxed.settings);
    expect(r.score).toBe(90); // "fast" no longer vague (+10), 5 > 3 so C7 fails (-10)
    expect(r.band).toBe("Needs work"); // and C7 caps the band
  });
});

describe("parseCustomChecks", () => {
  it("skips blank rows and keeps valid checks", () => {
    expect(parseCustomChecks(["Design", ""], ["any", "any"], ["figma.com", ""])).toEqual({
      ok: true,
      checks: [{ name: "Design", field: "any", phrase: "figma.com" }],
    });
  });

  it("explains half-filled or invalid rows", () => {
    const result = parseCustomChecks(["", "Design", "X"], ["any", "any", "nowhere"], ["figma", "", "y"]);
    expect(result).toEqual({
      ok: false,
      errors: { "check-0": "Give this check a name.", "check-1": 'Say what "Design" must contain.', "check-2": "Choose where to look." },
    });
  });

  it("drops malformed stored checks", () => {
    expect(readCustomChecks([{ name: "A", field: "any", phrase: "b" }, { name: "", field: "any", phrase: "x" }, "junk", null])).toEqual([
      { name: "A", field: "any", phrase: "b" },
    ]);
    expect(readCustomChecks("nope")).toEqual([]);
  });
});

describe("parseDoneStatuses", () => {
  it("splits on commas and lines, trims and keeps the order typed", () => {
    expect(parseDoneStatuses(" Released,\nAccepted ,  Ready  for QA ")).toEqual({
      ok: true,
      statuses: ["Released", "Accepted", "Ready for QA"],
    });
  });

  it("drops duplicates ignoring case, keeping the first spelling", () => {
    expect(parseDoneStatuses("Done, done, DONE, Closed")).toEqual({ ok: true, statuses: ["Done", "Closed"] });
  });

  it("needs at least one status", () => {
    expect(parseDoneStatuses(" , \n ")).toEqual({ ok: false, error: "Add at least one status, such as Done." });
  });

  it("limits the length and the count", () => {
    expect(parseDoneStatuses("x".repeat(SETTINGS_LIMITS.statusLength + 1)).ok).toBe(false);
    const many = Array.from({ length: SETTINGS_LIMITS.doneStatuses + 1 }, (_, i) => `S${i}`).join(",");
    expect(parseDoneStatuses(many).ok).toBe(false);
  });
});
