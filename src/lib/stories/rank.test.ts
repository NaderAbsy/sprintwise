import { describe, expect, it } from "vitest";
import { planMove } from "@/lib/stories/rank";

const list = (...ranks: number[]) => ranks.map((rank, i) => ({ id: String.fromCharCode(97 + i), rank }));

describe("planMove", () => {
  it("moves to the top, the bottom, and between two stories", () => {
    expect(planMove(list(1, 2, 3), "c", 0)).toEqual({ kind: "rank", rank: 0 });
    expect(planMove(list(1, 2, 3), "a", 2)).toEqual({ kind: "rank", rank: 4 });
    expect(planMove(list(1, 2, 3), "c", 1)).toEqual({ kind: "rank", rank: 1.5 });
  });

  it("does nothing when the story stays put or isn't there", () => {
    expect(planMove(list(1, 2, 3), "b", 1)).toEqual({ kind: "none" });
    expect(planMove(list(1, 2, 3), "z", 0)).toEqual({ kind: "none" });
  });

  it("clamps positions outside the list", () => {
    expect(planMove(list(1, 2, 3), "b", -5)).toEqual({ kind: "rank", rank: 0 });
    expect(planMove(list(1, 2, 3), "b", 99)).toEqual({ kind: "rank", rank: 4 });
  });

  it("renumbers when neighbours are too close to split", () => {
    expect(planMove(list(1, 1 + 1e-7, 3), "c", 1)).toEqual({ kind: "renumber", ids: ["a", "c", "b"] });
  });
});
