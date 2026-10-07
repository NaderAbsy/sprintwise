import { TEMPLATE_COLUMNS } from "@/lib/csv/template";
import type { Story } from "@/lib/stories/types";

export type ExportRow = Story & { score: number | null; band: string | null; failedChecks: string[] };

/**
 * Spreadsheet apps run cells that start with =, +, @ or a tab as formulas.
 * Those get a leading apostrophe. A "-" counts only when it isn't a list
 * bullet ("- item"), so acceptance criteria still round-trip into the importer.
 */
function neutralize(cell: string): string {
  if (/^[=+@\t\r]/.test(cell) || /^-[^\s]/.test(cell)) return `'${cell}`;
  return cell;
}

function quote(cell: string): string {
  const safe = neutralize(cell);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The backlog as CSV: the import template's columns first (so it re-imports), then the score. */
export function backlogCsv(rows: ExportRow[]): string {
  const header = [...TEMPLATE_COLUMNS, "readiness_score", "band", "failed_checks"];
  const lines = rows.map((r) =>
    [
      r.key,
      r.title,
      r.description,
      r.acceptanceCriteria,
      r.storyPoints === null ? "" : String(r.storyPoints),
      r.status,
      r.score === null ? "" : String(r.score),
      r.band ?? "",
      r.failedChecks.join("; "),
    ]
      .map(quote)
      .join(","),
  );
  // A byte-order mark so Excel reads the file as UTF-8.
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}

/** One story as plain text, ready to paste into Jira, Slack or a doc. */
export function storyAsText(story: Story): string {
  const parts = [`${story.key}: ${story.title}`];
  if (story.description) parts.push("", story.description);
  if (story.acceptanceCriteria) parts.push("", "Acceptance criteria:", story.acceptanceCriteria);
  const meta = [story.storyPoints !== null && `Story points: ${story.storyPoints}`, story.status && `Status: ${story.status}`].filter(Boolean);
  if (meta.length > 0) parts.push("", ...(meta as string[]));
  return parts.join("\n");
}

/**
 * Stories edited in Sprintwise, with Jira's own column names, so they can go
 * back through Jira's CSV import (matched on Issue key) or be copied by hand.
 */
export function jiraCsv(stories: Story[]): string {
  const header = ["Issue key", "Summary", "Issue Type", "Description", "Acceptance Criteria", "Story Points"];
  const lines = stories.map((s) =>
    [s.key, s.title, s.issueType || "Story", s.description, s.acceptanceCriteria, s.storyPoints === null ? "" : String(s.storyPoints)]
      .map(quote)
      .join(","),
  );
  return `\uFEFF${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
