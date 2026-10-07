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
