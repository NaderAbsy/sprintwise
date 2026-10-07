import Papa from "papaparse";
import {
  EPIC_ALIASES,
  EPIC_MAX_LENGTH,
  HEADER_ALIASES,
  IMPORT_FIELDS,
  LABEL_ALIASES,
  MAX_BYTES,
  MAX_ROWS,
  REQUIRED_COLUMNS,
  type ColumnMapping,
  type ImportField,
} from "@/lib/csv/template";
import { STORY_LIMITS } from "@/lib/stories/form";
import { normalizeKey, parsePoints, type Story } from "@/lib/stories/types";

export type CsvIssue = {
  /** 1-based data row (the header is row 0); absent for file-level problems. */
  row?: number;
  message: string;
};

export type CsvResult =
  | { ok: true; stories: Story[]; warnings: CsvIssue[] }
  | { ok: false; errors: CsvIssue[] };

/** One data row of an import: the story, its epic and labels, and anything wrong with it. */
export type CsvRow = {
  row: number;
  story: Story;
  epic: string;
  labels: string[];
  errors: string[];
  warnings: string[];
};

export type CsvTable =
  | {
      ok: true;
      headers: string[];
      /** The column each field was read from (an index into headers), or null. */
      columns: Record<ImportField, number | null>;
      rows: CsvRow[];
    }
  | { ok: false; headers: string[]; errors: CsvIssue[]; missing: ImportField[] };

const clean = (header: string) => header.replace(/^﻿/, "").trim();
const lower = (header: string) => clean(header).toLowerCase().replace(/\s+/g, " ");

const HEADER_HELP =
  'Sprintwise needs a key column (named "key" or "Issue key") and a title column ("title" or "Summary"). In Jira, show the Key and Summary columns before exporting, and set Jira\'s language to English.';

/** Lists the column names the file has, so the person can see what to rename. */
function foundColumns(headers: string[]): string {
  const named = headers.filter(Boolean);
  if (named.length === 0) return `The first row has no column names. ${HEADER_HELP}`;
  const shown = named.slice(0, 12).map((h) => `"${h.length > 40 ? `${h.slice(0, 40)}…` : h}"`);
  const more = named.length > shown.length ? ` and ${named.length - shown.length} more` : "";
  return `The file's columns are ${shown.join(", ")}${more}. ${HEADER_HELP}`;
}

/** Picks the column for each field: the person's choice first, then known header names. */
export function matchColumns(headers: string[], mapping: ColumnMapping = {}): Record<ImportField, number | null> {
  const names = headers.map(lower);
  const byName = (candidates: string[]) => {
    for (const candidate of candidates) {
      const index = names.indexOf(candidate);
      if (index >= 0) return index;
    }
    return null;
  };
  const columns = {} as Record<ImportField, number | null>;
  for (const { field } of IMPORT_FIELDS) {
    const chosen = mapping[field];
    if (chosen === null) {
      columns[field] = null;
      continue;
    }
    if (chosen !== undefined) {
      const index = headers.map(clean).indexOf(chosen);
      if (index >= 0) {
        columns[field] = index;
        continue;
      }
    }
    columns[field] =
      field === "epic"
        ? byName(EPIC_ALIASES)
        : byName(Object.entries(HEADER_ALIASES).filter(([, to]) => to === field).map(([from]) => from));
  }
  return columns;
}

/** The checks a story must pass wherever it comes from: a CSV row, or the browser's pick sent to the server. */
export function storyProblems(story: Story, epic = ""): string[] {
  const problems: string[] = [];
  if (story.key === "") problems.push("The key is empty.");
  if (story.title === "") problems.push("The title is empty.");
  const tooLong = (value: string, limit: number, label: string) => {
    if (value.length > limit) problems.push(`The ${label} is longer than ${limit} characters.`);
  };
  tooLong(story.key, STORY_LIMITS.key, "key");
  tooLong(story.title, STORY_LIMITS.title, "title");
  tooLong(story.description, STORY_LIMITS.description, "description");
  tooLong(story.acceptanceCriteria, STORY_LIMITS.acceptanceCriteria, "acceptance criteria");
  tooLong(story.status, STORY_LIMITS.status, "status");
  tooLong(epic, EPIC_MAX_LENGTH, "epic");
  if (story.storyPoints !== null && story.storyPoints > STORY_LIMITS.points) {
    problems.push(`Story points can't be more than ${STORY_LIMITS.points}.`);
  }
  return problems;
}

/**
 * Reads a CSV into rows, each checked on its own, so an import can show every
 * story and leave out only the ones with problems. File-level problems (too
 * big, no key or title column) stop it.
 */
export function readCsvTable(
  text: string,
  { mapping, maxBytes, maxRows, tooManyHint = "" }: { mapping?: ColumnMapping; maxBytes: number; maxRows: number; tooManyHint?: string },
): CsvTable {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxBytes) {
    return { ok: false, headers: [], missing: [], errors: [{ message: `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` }] };
  }

  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const [headerRow = [], ...data] = parsed.data;
  const headers = headerRow.map(clean);
  const columns = matchColumns(headers, mapping);

  const missing = REQUIRED_COLUMNS.filter((c) => columns[c] === null);
  if (missing.length > 0) {
    return {
      ok: false,
      headers,
      missing,
      errors: [
        { message: `Missing required ${missing.length === 1 ? "column" : "columns"}: ${missing.join(", ")}.` },
        { message: foundColumns(headers) },
      ],
    };
  }
  if (data.length === 0) return { ok: false, headers, missing: [], errors: [{ message: "The file has no stories." }] };
  if (data.length > maxRows) {
    return {
      ok: false,
      headers,
      missing: [],
      errors: [{ message: `The file has ${data.length.toLocaleString("en")} stories; the maximum is ${maxRows.toLocaleString("en")}.${tooManyHint}` }],
    };
  }

  // Broken quoting and the like, by data row (the header is parsed row 0).
  const rowErrors = new Map<number, string[]>();
  for (const error of parsed.errors) {
    const row = error.row ?? 0;
    rowErrors.set(row, [...(rowErrors.get(row) ?? []), error.message]);
  }

  const labelColumns = headers.flatMap((h, i) => (LABEL_ALIASES.includes(lower(h)) ? [i] : []));
  const seen = new Map<string, number>();
  const rows = data.map((cells, index): CsvRow => {
    const row = index + 1;
    const cell = (field: ImportField) => {
      const column = columns[field];
      return column === null ? "" : (cells[column] ?? "").trim();
    };
    const errors = [...(rowErrors.get(row) ?? [])];
    const warnings: string[] = [];

    const rawPoints = cell("story_points");
    const { points, valid } = parsePoints(rawPoints);
    if (!valid) warnings.push(`Story points "${rawPoints}" isn't a number of 0 or more, so it counts as not estimated.`);

    const story: Story = {
      key: normalizeKey(cell("key")),
      title: cell("title"),
      description: cell("description"),
      acceptanceCriteria: cell("acceptance_criteria"),
      storyPoints: points,
      status: cell("status"),
    };
    const epic = cell("epic");
    errors.push(...storyProblems(story, epic));

    if (story.key !== "") {
      const firstRow = seen.get(story.key);
      if (firstRow !== undefined) errors.push(`Duplicate key ${cell("key")} (first used on row ${firstRow}).`);
      else seen.set(story.key, row);
    }

    const labels = [...new Set(labelColumns.map((i) => (cells[i] ?? "").trim()).filter(Boolean))];
    return { row, story, epic, labels, errors, warnings };
  });

  return { ok: true, headers, columns, rows };
}

/**
 * Parses a CSV in the Sprintwise template (or a Jira export with matching
 * headers) as one whole: any problem rejects the file. Sprint snapshots use
 * this, since a snapshot must be the complete sprint. Points that aren't
 * numbers become warnings and count as not estimated.
 */
export function parseStoriesCsv(text: string): CsvResult {
  const table = readCsvTable(text, {
    maxBytes: MAX_BYTES,
    maxRows: MAX_ROWS,
    tooManyHint: " Split it into smaller files, or narrow your Jira search before exporting.",
  });
  if (!table.ok) return { ok: false, errors: table.errors };
  const errors = table.rows.flatMap((r) => r.errors.map((message) => ({ row: r.row, message })));
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    stories: table.rows.map((r) => r.story),
    warnings: table.rows.flatMap((r) => r.warnings.map((message) => ({ row: r.row, message }))),
  };
}
