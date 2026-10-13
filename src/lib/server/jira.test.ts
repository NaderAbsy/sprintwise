import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/server/auth", () => ({ auth: { api: {} } }));
vi.mock("@/lib/server/db", () => ({ db: {} }));

const { issuesAsCsv, JIRA_CUT } = await import("@/lib/server/jira");
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

describe("issuesAsCsv with text longer than Sprintwise keeps", () => {
  it("cuts it short and marks it, so the issue still imports and syncs", () => {
    const csv = issuesAsCsv([
      {
        key: "ABC-9",
        summary: "S".repeat(400),
        description: "D".repeat(9000),
        acceptanceCriteria: "- One",
        storyPoints: 5000,
        status: "In Progress",
        issueType: "Story",
        parent: "",
        labels: [],
        created: null,
      },
    ]);
    const table = readCsvTable(csv, { maxBytes: 1_000_000, maxRows: 1000 });
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    const [row] = table.rows;
    expect(row.errors).toEqual([]);
    expect(row.story.title).toHaveLength(300);
    expect(row.story.description).toHaveLength(5000);
    expect(row.story.description.endsWith(JIRA_CUT)).toBe(true);
    // An estimate too big to keep is left blank rather than blocking the status update.
    expect(row.story.storyPoints).toBeNull();
    expect(row.story.status).toBe("In Progress");
  });
});

describe("issuesAsCsv with criteria past the cut", () => {
  it("moves the criteria section to the criteria column before cutting the description", () => {
    const description = `As an agent I want refunds over the total blocked so that we never overpay.\n\n${"Background. ".repeat(600)}\n\nh3. Acceptance criteria\n* A refund above the total is refused`;
    const csv = issuesAsCsv([
      { key: "ABC-7", summary: "Block big refunds", description, acceptanceCriteria: "", storyPoints: 3, status: "Idea", issueType: "Feature", parent: "", labels: [], created: null },
    ]);
    const table = readCsvTable(csv, { maxBytes: 1_000_000, maxRows: 1000 });
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    expect(table.rows[0].story.acceptanceCriteria).toBe("* A refund above the total is refused");
    expect(table.rows[0].story.description.endsWith(JIRA_CUT)).toBe(true);
  });

  it("doesn't list a sub-task's parent story as its epic", () => {
    const csv = issuesAsCsv([
      { key: "ABC-8", summary: "Add the button", description: "", acceptanceCriteria: "", storyPoints: 1, status: "Idea", issueType: "Subtask", parent: "Rebook my cleaner", labels: [], created: null },
    ]);
    const table = readCsvTable(csv, { maxBytes: 1_000_000, maxRows: 1000 });
    expect(table.ok && table.rows[0].epic).toBe("");
  });
});

describe("isJiraKey", () => {
  it("accepts issue keys and refuses anything that could change the request's path", async () => {
    const { isJiraKey } = await import("@/lib/server/jira");
    for (const key of ["ABC-1", "SCRUM_2-345", "a1-9"]) expect(isJiraKey(key), key).toBe(true);
    for (const key of ["..", ".", "../x", "ABC-1/../2", "ABC", "-1", "ABC-1?x", "ABC-", "TIDY 1"]) expect(isJiraKey(key), key).toBe(false);
  });
});
