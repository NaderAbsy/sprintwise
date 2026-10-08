import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/server/auth", () => ({ auth: { api: {} } }));
vi.mock("@/lib/server/db", () => ({ db: {} }));

const { issuesAsCsv } = await import("@/lib/server/jira");
const { readCsvTable } = await import("@/lib/csv/parse");

describe("issuesAsCsv", () => {
  it("round-trips Jira issues through the import reader, quotes, line breaks, labels and all", () => {
    const csv = issuesAsCsv([
      {
        key: "ABC-1",
        summary: 'Refund "partial" payments, fast',
        description: "h3. Context\nLine two, with a comma",
        acceptanceCriteria: "- One\n- Two",
        storyPoints: 3,
        status: "To Do",
        issueType: "Story",
        parent: "Refunds",
        labels: ["web", "payments"],
        created: null,
      },
      {
        key: "ABC-2",
        summary: "Fix the total",
        description: "",
        acceptanceCriteria: "",
        storyPoints: null,
        status: "In Progress",
        issueType: "Bug",
        parent: "",
        labels: [],
        created: null,
      },
    ]);
    const table = readCsvTable(csv, { maxBytes: 1_000_000, maxRows: 1000 });
    if (!table.ok) throw new Error(JSON.stringify(table.errors));
    expect(table.rows[0]).toMatchObject({
      story: {
        key: "ABC-1",
        title: 'Refund "partial" payments, fast',
        description: "h3. Context\nLine two, with a comma",
        acceptanceCriteria: "- One\n- Two",
        storyPoints: 3,
        status: "To Do",
        issueType: "Story",
      },
      epic: "Refunds",
      labels: ["web", "payments"],
      errors: [],
    });
    expect(table.rows[1]).toMatchObject({ story: { key: "ABC-2", storyPoints: null, issueType: "Bug" }, epic: "", labels: [] });
  });
});

describe("isJiraKey", () => {
  it("accepts issue keys and refuses anything that could change the request's path", async () => {
    const { isJiraKey } = await import("@/lib/server/jira");
    for (const key of ["ABC-1", "SCRUM_2-345", "a1-9"]) expect(isJiraKey(key), key).toBe(true);
    for (const key of ["..", ".", "../x", "ABC-1/../2", "ABC", "-1", "ABC-1?x", "ABC-", "TIDY 1"]) expect(isJiraKey(key), key).toBe(false);
  });
});
