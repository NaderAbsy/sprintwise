import { describe, expect, it } from "vitest";
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
