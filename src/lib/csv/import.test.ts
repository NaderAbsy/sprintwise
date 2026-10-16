import { describe, expect, it } from "vitest";
import { readImportedFields, readLeftOut } from "@/lib/csv/import";

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
