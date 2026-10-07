import { describe, expect, it } from "vitest";
import { readImportPayload } from "@/lib/csv/import";
import { matchColumns, parseStoriesCsv, readCsvTable, rememberedColumns } from "@/lib/csv/parse";
import { readCsvFile } from "@/lib/csv/read";
import { IMPORT_FILE_BYTES, IMPORT_FILE_ROWS, IMPORT_MAX_STORIES, MAX_ROWS, TEMPLATE_CSV } from "@/lib/csv/template";

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

  it("accepts a Jira export's headers, reads the issue type and ignores extra columns", () => {
    const csv = "Issue key,Summary,Issue Type,Story point estimate,Status,Reporter\nab-7,Login page,Bug,2,In Progress,Sam";
    expect(ok(csv).stories).toEqual([
      { key: "AB-7", title: "Login page", description: "", acceptanceCriteria: "", storyPoints: 2, status: "In Progress", issueType: "Bug" },
    ]);
  });

  it("strips a UTF-8 BOM from Excel", () => {
    expect(ok("﻿key,title\nA-1,Thing").stories[0].key).toBe("A-1");
  });

  it("only needs key and title", () => {
    expect(ok("title,key\nThing,A-1").stories[0]).toMatchObject({ key: "A-1", storyPoints: null });
  });

  it("names a missing required column", () => {
    expect(errors("key,description\nA-1,x")[0]).toBe("Missing required column: title.");
    expect(errors("description\nx")[0]).toBe("Missing required columns: key, title.");
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

  it("reads Jira's newer and all-fields header names", () => {
    const { stories } = ok(
      "Work item key,Summary,Custom field (Story point estimate),Custom field (Acceptance Criteria)\nA-1,One,3,- It works",
    );
    expect(stories[0]).toMatchObject({ key: "A-1", title: "One", storyPoints: 3, acceptanceCriteria: "- It works" });
  });

  it("names the columns it found when the required ones are missing", () => {
    expect(errors("Clé,Résumé,Statut\nA-1,Un,À faire")).toEqual([
      "Missing required columns: key, title.",
      expect.stringMatching(/^The file's columns are "Clé", "Résumé", "Statut"\. Sprintwise needs a key column/),
    ]);
    const many = Array.from({ length: 15 }, (_, i) => `Field ${i + 1}`).join(",");
    expect(errors(`${many}\n${"x,".repeat(14)}x`)[1]).toContain('"Field 12" and 3 more.');
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

describe("readCsvFile", () => {
  const text = "key,title\nA-1,Café";
  it("reads UTF-8, with or without a byte-order mark", async () => {
    expect(await readCsvFile(new Blob([text]))).toEqual({ ok: true, text });
    expect(await readCsvFile(new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), text]))).toEqual({ ok: true, text });
  });

  it("reads the UTF-16 files Excel saves as Unicode text", async () => {
    const le = new Uint8Array(2 + text.length * 2);
    le.set([0xff, 0xfe]);
    for (let i = 0; i < text.length; i++) le[2 + i * 2] = text.charCodeAt(i);
    expect(await readCsvFile(new Blob([le]))).toEqual({ ok: true, text });
    const be = le.map((_, i) => (i < 2 ? [0xfe, 0xff][i] : le[i % 2 === 0 ? i + 1 : i - 1]));
    expect(await readCsvFile(new Blob([be]))).toEqual({ ok: true, text });
  });

  it("turns away spreadsheets saved with a .csv name, saying how to export a CSV", async () => {
    const zip = (entry: string) => new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]), entry, new Uint8Array([0, 1, 2])]);
    const message = async (blob: Blob) => {
      const r = await readCsvFile(Object.assign(blob, { name: "Jira.CSV" }));
      return r.ok ? "" : r.message;
    };
    expect(await message(zip("Index/Document.iwa"))).toBe(
      "Jira.CSV isn't a CSV, even if its name ends in .csv: it's a Numbers spreadsheet. In Numbers, choose File → Export To → CSV…, then use the exported file.",
    );
    expect(await message(zip("[Content_Types].xml xl/workbook.xml"))).toMatch(/: it's an Excel workbook\. In Excel, choose File → Save As/);
    expect(await message(new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1])]))).toMatch(/an Excel workbook/);
    expect(await message(zip("something.txt"))).toMatch(/a compressed file/);
    expect(await message(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])]))).toMatch(/not a text file/);
  });
});

describe("readCsvTable (backlog imports)", () => {
  const read = (text: string, mapping = {}) => readCsvTable(text, { mapping, maxBytes: IMPORT_FILE_BYTES, maxRows: IMPORT_FILE_ROWS });

  it("keeps good rows when others have problems, each with its own reasons", () => {
    const table = read("key,title,story_points\nA-1,One,3\nA-2,,2\nA-1,Again,1\nA-3,Three,XL");
    if (!table.ok) throw new Error("expected rows");
    expect(table.rows.map((r) => [r.row, r.errors.length])).toEqual([[1, 0], [2, 1], [3, 1], [4, 0]]);
    expect(table.rows[1].errors).toEqual(["The title is empty."]);
    expect(table.rows[2].errors[0]).toMatch(/^Duplicate key A-1/);
    expect(table.rows[3].warnings[0]).toContain('"XL"');
  });

  it("reads Jira's epic and repeated Labels columns", () => {
    const table = read("Issue key,Summary,Parent,Parent summary,Labels,Labels,Labels\nA-1,One,10001,Checkout,web,,mobile\nA-2,Two,,,,,");
    if (!table.ok) throw new Error("expected rows");
    expect(table.rows[0]).toMatchObject({ epic: "Checkout", labels: ["web", "mobile"] });
    expect(table.rows[1]).toMatchObject({ epic: "", labels: [] });
  });

  it("uses the columns the person picked, and can leave one out", () => {
    const text = "Ticket,Name,Size,Status\nA-1,One,3,To Do";
    const missing = read(text);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.missing).toEqual(["key", "title"]);
      expect(missing.headers).toEqual(["Ticket", "Name", "Size", "Status"]);
    }
    const picked = read(text, { key: "Ticket", title: "Name", story_points: "Size", status: null });
    if (!picked.ok) throw new Error("expected rows");
    expect(picked.rows[0].story).toMatchObject({ key: "A-1", title: "One", storyPoints: 3, status: "" });
  });

  it("remembers picked columns only, so a column missing last time is found by name next time", () => {
    const saved = rememberedColumns({ key: "Ticket", description: null, nonsense: "x", title: 3 });
    expect(saved).toEqual({ key: "Ticket" });
    expect(matchColumns(["Ticket", "Summary", "Description"], saved)).toMatchObject({ key: 0, title: 1, description: 2 });
    expect(rememberedColumns(null)).toEqual({});
    expect(rememberedColumns(["key"])).toEqual({});
  });

  it("falls back to header names when a remembered column isn't in this file", () => {
    expect(matchColumns(["Issue key", "Summary"], { key: "Ticket" })).toMatchObject({ key: 0, title: 1, epic: null });
  });

  it("takes files of up to 1,000 rows", () => {
    const rows = (n: number) => ["key,title", ...Array.from({ length: n }, (_, i) => `K-${i},Story ${i}`)].join("\n");
    expect(read(rows(IMPORT_FILE_ROWS)).ok).toBe(true);
    const over = read(rows(IMPORT_FILE_ROWS + 1));
    expect(over.ok ? "" : over.errors[0].message).toBe("The file has 1,001 stories; the maximum is 1,000.");
  });
});

describe("readImportPayload (what the browser sends)", () => {
  const story = { key: " a-1 ", title: " One ", description: "", acceptanceCriteria: "", storyPoints: 3, status: "To Do", epic: " Checkout " };

  it("tidies and accepts good stories, keeping the column choices", () => {
    const result = readImportPayload(JSON.stringify([story]), JSON.stringify({ key: "Ticket", status: null, nonsense: "x" }));
    expect(result).toEqual({
      ok: true,
      stories: [{ ...story, key: "A-1", title: "One", epic: "Checkout", issueType: "" }],
      mapping: {},
    });
    const clean = readImportPayload(JSON.stringify([story]), JSON.stringify({ key: "Ticket", status: null }));
    expect(clean.ok && clean.mapping).toEqual({ key: "Ticket", status: null });
  });

  it("repeats the file checks, since anything can be sent", () => {
    const bad = (stories: unknown) => {
      const r = readImportPayload(JSON.stringify(stories), "");
      return r.ok ? "" : r.error;
    };
    expect(bad([])).toBe("Tick at least one story to import.");
    expect(bad([{ ...story, title: "" }])).toBe("A-1: The title is empty.");
    expect(bad([story, story])).toBe("A-1 is ticked twice.");
    expect(bad([{ ...story, storyPoints: -1 }])).toMatch(/expected shape/);
    expect(bad([{ ...story, epic: "x".repeat(201) }])).toBe("A-1: The epic is longer than 200 characters.");
    expect(bad(Array.from({ length: IMPORT_MAX_STORIES + 1 }, (_, i) => ({ ...story, key: `K-${i}` })))).toMatch(/^Import up to 500/);
    expect(readImportPayload("not json", "")).toEqual({ ok: false, error: "Choose a CSV file and tick the stories to import." });
  });
});
