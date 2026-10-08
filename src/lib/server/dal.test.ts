import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/server/auth", () => ({ auth: { api: {} } }));
vi.mock("@/lib/server/db", () => ({ db: {} }));

const { isId } = await import("@/lib/server/dal");

describe("isId", () => {
  it("accepts the ids the database makes", () => {
    expect(isId("cmuyfiyy7000006i9o116iiic")).toBe(true);
  });

  it("refuses anything a crafted request could turn into a database filter or path", () => {
    for (const value of [{ not: "" }, { in: ["a"] }, ["a"], 1, null, undefined, "", "../x", "a b", "x".repeat(65)]) {
      expect(isId(value), JSON.stringify(value)).toBe(false);
    }
  });
});
