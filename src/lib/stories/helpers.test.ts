import { describe, expect, it } from "vitest";
import { DEFAULT_VAGUE_WORDS, findVagueWords } from "@/lib/readiness/rules";
import { hasPlaceholders, SCENARIO_TEMPLATE, STORY_TEMPLATE, vagueWordTips } from "@/lib/stories/helpers";

describe("vagueWordTips", () => {
  it("groups similar words under one tip and covers custom words", () => {
    const tips = vagueWordTips(["fast", "Quick", "easy", "synergy"]);
    expect(tips.map((t) => t.words)).toEqual([["fast", "quick"], ["easy"], ["synergy"]]);
    expect(tips[2].tip).toBe("Replace it with something you could measure or check.");
  });
});

describe("hasPlaceholders", () => {
  it("spots untouched templates only", () => {
    expect(hasPlaceholders(STORY_TEMPLATE)).toBe(true);
    expect(hasPlaceholders(SCENARIO_TEMPLATE)).toBe(true);
    expect(hasPlaceholders("As a customer I want [x] so that y")).toBe(false);
  });
});

describe("vague word tips cover the defaults", () => {
  it("has a specific tip for every default vague word", () => {
    const generic = vagueWordTips(DEFAULT_VAGUE_WORDS).find((t) => t.tip.startsWith("Replace it with"));
    expect(generic).toBeUndefined();
  });

  it("never suggests a phrase that is itself vague", () => {
    for (const { tip } of vagueWordTips(DEFAULT_VAGUE_WORDS)) {
      const examples = [...tip.matchAll(/“([^”]+)”/g)].map((m) => m[1]).join("\n");
      expect(findVagueWords(examples, DEFAULT_VAGUE_WORDS), tip).toEqual([]);
    }
  });
});
