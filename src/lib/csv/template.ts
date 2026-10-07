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

/** Sprint snapshot uploads: the whole file is the sprint, and it's checked on the server. */
export const MAX_ROWS = 200;
export const MAX_BYTES = 1024 * 1024;

/**
 * Backlog imports: the file is read in the browser, where the person picks the
 * stories they want; only those are sent, up to IMPORT_MAX_STORIES at a time.
 */
export const IMPORT_FILE_ROWS = 1000;
export const IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_STORIES = 500;
/** What the ticked stories may add up to when sent; next.config allows 4 MB per request. */
export const IMPORT_MAX_BYTES = 3.8 * 1024 * 1024;
export const EPIC_MAX_LENGTH = 200;

/** Fields an import can fill, in the order the column matcher shows them. */
export const IMPORT_FIELDS = [
  { field: "key", label: "Key", required: true },
  { field: "title", label: "Title", required: true },
  { field: "description", label: "Description" },
  { field: "acceptance_criteria", label: "Acceptance criteria" },
  { field: "story_points", label: "Story points" },
  { field: "status", label: "Status" },
  { field: "epic", label: "Epic" },
] as const satisfies readonly { field: string; label: string; required?: boolean }[];

export type ImportField = (typeof IMPORT_FIELDS)[number]["field"];

/** Which header the person picked for each field; null means "not in this file". Unset fields are matched by name. */
export type ColumnMapping = Partial<Record<ImportField, string | null>>;

/** Header names for the epic, best first: Jira's parent summary reads better than an id or a key. */
export const EPIC_ALIASES = [
  "parent summary",
  "epic name",
  "custom field (epic name)",
  "epic",
  "epic link",
  "custom field (epic link)",
  "parent",
];

/** Jira repeats the Labels column once per label. */
export const LABEL_ALIASES = ["labels", "label"];

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
