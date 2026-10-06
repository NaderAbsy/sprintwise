import Papa from "papaparse";
import {
  HEADER_ALIASES,
  MAX_BYTES,
  MAX_ROWS,
  REQUIRED_COLUMNS,
  type TemplateColumn,
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

function canonicalHeader(header: string): string {
  const cleaned = header.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");
  return HEADER_ALIASES[cleaned] ?? `__ignored:${cleaned}`;
}

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

/**
 * Parses a CSV in the Sprintwise template (or a Jira export with matching
 * headers). File-level problems and row errors reject the whole file; points
 * that aren't numbers become warnings and count as not estimated.
 */
export function parseStoriesCsv(text: string): CsvResult {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_BYTES) {
    return { ok: false, errors: [{ message: "The file is larger than 1 MB." }] };
  }

  const headers: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => {
      headers.push(header.trim());
      return canonicalHeader(header);
    },
  });

  const columns = new Set(parsed.meta.fields ?? []);
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c));
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        { message: `Missing required ${missing.length === 1 ? "column" : "columns"}: ${missing.join(", ")}.` },
        { message: foundColumns(headers) },
      ],
    };
  }

  if (parsed.data.length === 0) {
    return { ok: false, errors: [{ message: "The file has no stories." }] };
  }
  if (parsed.data.length > MAX_ROWS) {
    return {
      ok: false,
      errors: [{ message: `The file has ${parsed.data.length} stories; the maximum is ${MAX_ROWS}. Split it into smaller files, or narrow your Jira search before exporting.` }],
    };
  }

  const errors: CsvIssue[] = [];
  const warnings: CsvIssue[] = [];
  const stories: Story[] = [];
  const seen = new Map<string, number>();

  for (const error of parsed.errors) {
    // Papa reports a short row as "TooFewFields"; the missing cells are simply blank.
    if (error.code === "TooFewFields") continue;
    errors.push({ row: (error.row ?? 0) + 1, message: error.message });
  }

  parsed.data.forEach((record, index) => {
    const row = index + 1;
    const cell = (column: TemplateColumn) => (record[column] ?? "").trim();

    const key = cell("key");
    const title = cell("title");
    if (key === "") errors.push({ row, message: "The key is empty." });
    if (title === "") errors.push({ row, message: "The title is empty." });
    const tooLong = (column: TemplateColumn, limit: number, label: string) => {
      if ((record[column] ?? "").trim().length > limit) errors.push({ row, message: `The ${label} is longer than ${limit} characters.` });
    };
    tooLong("key", STORY_LIMITS.key, "key");
    tooLong("title", STORY_LIMITS.title, "title");
    tooLong("description", STORY_LIMITS.description, "description");
    tooLong("acceptance_criteria", STORY_LIMITS.acceptanceCriteria, "acceptance criteria");
    tooLong("status", STORY_LIMITS.status, "status");

    const normalized = normalizeKey(key);
    if (key !== "") {
      const firstRow = seen.get(normalized);
      if (firstRow !== undefined) {
        errors.push({ row, message: `Duplicate key ${key} (first used on row ${firstRow}).` });
      } else {
        seen.set(normalized, row);
      }
    }

    const { points, valid } = parsePoints(record.story_points);
    if (points !== null && points > STORY_LIMITS.points) {
      errors.push({ row, message: `Story points can't be more than ${STORY_LIMITS.points}.` });
    }
    if (!valid) {
      warnings.push({
        row,
        message: `Story points "${cell("story_points")}" isn't a number of 0 or more, so it counts as not estimated.`,
      });
    }

    stories.push({
      key: normalized,
      title,
      description: (record.description ?? "").trim(),
      acceptanceCriteria: (record.acceptance_criteria ?? "").trim(),
      storyPoints: points,
      status: cell("status"),
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, stories, warnings };
}
