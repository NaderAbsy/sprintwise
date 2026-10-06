/**
 * The frozen CSV template (see DECISIONS.md, 2026-10-01). Backlog imports and
 * sprint snapshots both use it. Changing it means changing the parser, the
 * downloadable template and the tests together.
 */
export const TEMPLATE_COLUMNS = [
  "key",
  "title",
  "description",
  "acceptance_criteria",
  "story_points",
  "status",
] as const;

export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

export const REQUIRED_COLUMNS: readonly TemplateColumn[] = ["key", "title"];

/** Header names from a Jira CSV export that map onto template columns. */
export const HEADER_ALIASES: Record<string, TemplateColumn> = {
  key: "key",
  "issue key": "key",
  "work item key": "key",
  title: "title",
  summary: "title",
  description: "description",
  acceptance_criteria: "acceptance_criteria",
  "acceptance criteria": "acceptance_criteria",
  story_points: "story_points",
  "story points": "story_points",
  "story point estimate": "story_points",
  status: "status",
  // "Export CSV (all fields)" names custom fields like this.
  "custom field (acceptance criteria)": "acceptance_criteria",
  "custom field (story points)": "story_points",
  "custom field (story point estimate)": "story_points",
};

export const MAX_ROWS = 200;
export const MAX_BYTES = 1024 * 1024;

export const TEMPLATE_CSV = [
  TEMPLATE_COLUMNS.join(","),
  [
    "DEMO-1",
    "Export invoices as PDF",
    '"As a finance admin I want to export an invoice as a PDF so that I can email it to a client"',
    '"- The export button appears on every invoice\n- The PDF matches the on-screen invoice"',
    "3",
    "To Do",
  ].join(","),
].join("\n");
