import { describe, expect, it } from "vitest";
import { readImportedFields, readImportPayload, readLeftOut } from "@/lib/csv/import";
import { IMPORT_MAX_BYTES } from "@/lib/csv/template";

describe("readImportedFields: the columns a file had (v2.22)", () => {
  it("turns matched columns into the story fields they fill", () => {
    expect(readImportedFields(JSON.stringify(["key", "title", "status"]))).toEqual(new Set(["title", "status"]));
    expect(readImportedFields(JSON.stringify(["key", "title", "acceptance_criteria", "story_points", "issue_type"]))).toEqual(
      new Set(["title", "acceptanceCriteria", "storyPoints", "issueType"]),
    );
  });
  it("means every field when nothing usable was sent", () => {
    expect(readImportedFields(null)).toBeUndefined();
    expect(readImportedFields("not json")).toBeUndefined();
    expect(readImportedFields(JSON.stringify({ key: true }))).toBeUndefined();
  });
  it("ignores names that aren't columns", () => {
    expect(readImportedFields(JSON.stringify(["title", "__proto__", 4]))).toEqual(new Set(["title"]));
  });
});

describe("readLeftOut: keys a Jira import didn't tick", () => {
  it("normalises, removes repeats and drops anything implausible", () => {
    expect(readLeftOut(JSON.stringify(["shop-4", "SHOP-4", " SHOP-9 ", "", 7, "x".repeat(61)]))).toEqual(["SHOP-4", "SHOP-9"]);
    expect(readLeftOut("nope")).toEqual([]);
  });
});

describe("a selection sent straight to the server", () => {
  const ok = { key: "A-1", title: "Pay by card", description: "", acceptanceCriteria: "", storyPoints: 1, status: "To Do", issueType: "", epic: "" };

  it("is refused with a null character in any field, with a message that says what to remove", () => {
    const result = readImportPayload(JSON.stringify([{ ...ok, title: "Pay\u0000 by card" }]), "{}");
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toMatch(/null character/);
  });

  it("is refused when it is larger than the browser would ever send", () => {
    const huge = "[" + `"${"x".repeat(IMPORT_MAX_BYTES)}"` + "]";
    expect(readImportPayload(huge, "{}")).toEqual({ ok: false, error: "That selection is too large to import in one go. Tick fewer stories." });
  });
});
