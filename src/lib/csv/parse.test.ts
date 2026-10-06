import { describe, expect, it } from "vitest";
import { parseStoriesCsv } from "@/lib/csv/parse";
import { MAX_ROWS, TEMPLATE_CSV } from "@/lib/csv/template";

function ok(text: string) {
  const result = parseStoriesCsv(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

function errors(text: string) {
  const result = parseStoriesCsv(text);
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.errors.map((e) => (e.row ? `row ${e.row}: ${e.message}` : e.message));
}

describe("parseStoriesCsv", () => {
  it("parses the downloadable template, including line breaks inside cells", () => {
    const { stories, warnings } = ok(TEMPLATE_CSV);
    expect(warnings).toEqual([]);
    expect(stories).toEqual([
      {
        key: "DEMO-1",
        title: "Export invoices as PDF",
        description: "As a finance admin I want to export an invoice as a PDF so that I can email it to a client",
        acceptanceCriteria: "- The export button appears on every invoice\n- The PDF matches the on-screen invoice",
        storyPoints: 3,
        status: "To Do",
      },
    ]);
  });

  it("accepts a Jira export's headers and ignores extra columns", () => {
    const csv = "Issue key,Summary,Issue Type,Story point estimate,Status\nab-7,Login page,Story,2,In Progress";
    expect(ok(csv).stories).toEqual([
      { key: "AB-7", title: "Login page", description: "", acceptanceCriteria: "", storyPoints: 2, status: "In Progress" },
    ]);
  });

  it("strips a UTF-8 BOM from Excel", () => {
    expect(ok("﻿key,title\nA-1,Thing").stories[0].key).toBe("A-1");
  });

  it("only needs key and title", () => {
    expect(ok("title,key\nThing,A-1").stories[0]).toMatchObject({ key: "A-1", storyPoints: null });
  });

  it("names a missing required column", () => {
    expect(errors("key,description\nA-1,x")).toEqual(["Missing required column: title."]);
    expect(errors("description\nx")).toEqual(["Missing required columns: key, title."]);
  });

  it("rejects empty keys, empty titles and duplicate keys with row numbers", () => {
    expect(errors("key,title\n,No key\nA-1,\nA-2,One\na-2,Two")).toEqual([
      "row 1: The key is empty.",
      "row 2: The title is empty.",
      "row 4: Duplicate key a-2 (first used on row 3).",
    ]);
  });

  it("warns on points that aren't numbers and treats them as not estimated", () => {
    const { stories, warnings } = ok("key,title,story_points\nA-1,One,XL\nA-2,Two,0.5\nA-3,Three,");
    expect(stories.map((s) => s.storyPoints)).toEqual([null, 0.5, null]);
    expect(warnings).toEqual([{ row: 1, message: expect.stringContaining('"XL"') }]);
  });

  it("rejects files over the row limit", () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `K-${i},Story ${i}`);
    expect(errors(["key,title", ...rows].join("\n"))).toEqual([`The file has ${MAX_ROWS + 1} stories; the maximum is 200. Split it into smaller files, or narrow your Jira search before exporting.`]);
  });

  it("rejects files over 1 MB", () => {
    expect(errors(`key,title\nA-1,${"x".repeat(1024 * 1024)}`)).toEqual(["The file is larger than 1 MB."]);
  });

  it("rejects a file with no stories", () => {
    expect(errors("key,title\n\n")).toEqual(["The file has no stories."]);
  });
});

describe("parseStoriesCsv field limits", () => {
  const header = "key,title,description,acceptance_criteria,story_points,status";

  it("rejects a row whose description is too long", () => {
    const result = parseStoriesCsv(`${header}\nA-1,Title,"${"x".repeat(5001)}",,3,`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ row: 1, message: "The description is longer than 5000 characters." });
  });

  it("rejects absurd story points", () => {
    const result = parseStoriesCsv(`${header}\nA-1,Title,,,5000,`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].message).toBe("Story points can't be more than 1000.");
  });
});
