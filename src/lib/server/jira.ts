import "server-only";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { EPIC_MAX_LENGTH } from "@/lib/csv/template";
import { STORY_LIMITS } from "@/lib/stories/form";
import { cutText } from "@/lib/text";
import { readCsvTable } from "@/lib/csv/parse";
import { baseOf, JIRA_FIELDS, planSend, type JiraField, type JiraText } from "@/lib/stories/jira-merge";
import { criteriaFromDescription, withCriteriaInDescription } from "@/lib/stories/types";
import { FAKE_SITE, fakeChange, fakeIssue, fakeSearch } from "@/lib/server/jira-fake";

/**
 * Jira Cloud through Atlassian's OAuth 2.0 (3LO). Tokens are stored by Better
 * Auth (encrypted, refreshed when they expire); this module only reads issues
 * and writes back the fields a person changed in Sprintwise. REST API v2 is used
 * because it returns text fields as Jira wiki markup, which Sprintwise already
 * shows and keeps.
 */

/** Pretend Jira for end-to-end tests: invented issues, writes kept in memory. Never on a Vercel deploy. */
export const jiraFake = process.env.JIRA_FAKE === "true";
if (jiraFake && process.env.VERCEL_ENV) {
  throw new Error("JIRA_FAKE must not be set on a Vercel deploy.");
}

export const jiraConfigured = jiraFake || Boolean(process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET);

export type JiraSite = { id: string; name: string; url: string };

export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number | null;
  status: string;
  issueType: string;
  parent: string;
  labels: string[];
  /** When the issue was created in Jira (ISO), so Sync can tell new issues from ones left out at import. */
  created: string | null;
};

export class JiraError extends Error {}

/** Jira's results come back 100 at a time; a backlog import reads at most this many. */
export const JIRA_MAX_ISSUES = 1000;
const API = "https://api.atlassian.com";

/**
 * The REST base for one Jira site. Site ids come from Atlassian and keys from
 * stories; both are checked so neither can change which endpoint a request
 * reaches with the user's token ("..", "/" and the like).
 */
function siteApi(cloudId: string): string {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(cloudId)) throw new JiraError("That Jira site isn't one Sprintwise can open.");
  return `${API}/ex/jira/${cloudId}/rest/api/2`;
}

/** Jira issue keys look like ABC-123. */
export const isJiraKey = (key: string) => /^[A-Za-z][A-Za-z0-9_]{0,49}-\d{1,12}$/.test(key);

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/** The signed-in user's Atlassian account, if they connected one: the latest, if there's ever more than one. */
export async function jiraAccount(userId: string) {
  if (jiraFake) return { id: "fake-account" };
  if (!jiraConfigured) return null;
  return db.account.findFirst({ where: { userId, providerId: "atlassian" }, orderBy: { updatedAt: "desc" }, select: { id: true } });
}

/**
 * Holds the account's token lock until the transaction ends. $executeRaw, not
 * $queryRaw: the lock function returns `void`, a column type Prisma can't read.
 */
export async function lockToken(tx: Prisma.TransactionClient, accountId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`atlassian-token:${accountId}`}))`;
}

/** A token this close to expiring is refreshed first, so a long Sync or Send doesn't lose it halfway. */
const REFRESH_AHEAD_MS = 2 * 60_000;

async function accessToken(userId: string): Promise<string> {
  if (jiraFake) return "fake-token";
  const account = await jiraAccount(userId);
  if (!account) throw new JiraError("Connect Jira first.");
  try {
    // Atlassian replaces the refresh token each time it's used. Two requests refreshing at once (two tabs,
    // or a click during the nightly sync) would leave one holding a dead token, so one refreshes at a time;
    // the second then finds the fresh token. By user id rather than the browser's session, so the nightly
    // sync can use it too.
    return await db.$transaction(
      async (tx) => {
        await lockToken(tx, account.id);
        const stored = await tx.account.findUnique({ where: { id: account.id }, select: { accessTokenExpiresAt: true } });
        const expires = stored?.accessTokenExpiresAt?.getTime();
        const { accessToken } =
          expires !== undefined && expires - Date.now() < REFRESH_AHEAD_MS
            ? await auth.api.refreshToken({ body: { accountId: account.id, userId } })
            : await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
        if (!accessToken) throw new Error("no token");
        return accessToken;
      },
      { timeout: 30_000, maxWait: 30_000 },
    );
  } catch (error) {
    // Logged, so a failure on Sprintwise's side can't hide behind "expired" again.
    console.error("Jira token unavailable", { error: error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : String(error) });
    throw new JiraError("The Jira connection has expired. Connect Jira again.");
  }
}

/** Jira asked to slow down (429): whatever is in progress should stop, not keep asking. */
export class JiraBusyError extends JiraError {}

async function call<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // Said as Jira's problem, not the user's connection: this request ran on Sprintwise's server.
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new JiraError("Jira took too long to answer. Try again in a minute.");
    }
    throw new JiraError("Sprintwise couldn't reach Jira just now. Try again in a minute.");
  }
  if (response.status === 401) throw new JiraError("Jira didn't accept the connection. Connect Jira again.");
  if (response.status === 403) throw new JiraError("Your Jira account isn't allowed to do that on this site.");
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    const wait = Number.isFinite(seconds) && seconds > 0 ? `in ${seconds < 90 ? `${Math.ceil(seconds)} seconds` : `${Math.ceil(seconds / 60)} minutes`}` : "in a minute";
    throw new JiraBusyError(`Jira is busy and asked Sprintwise to wait. Try again ${wait}.`);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { errorMessages?: string[]; errors?: Record<string, string> } | null;
    const detail = [...(body?.errorMessages ?? []), ...Object.values(body?.errors ?? {})].join(" ").slice(0, 300);
    throw new JiraError(detail ? `Jira said: ${detail}` : `Jira returned an error (${response.status}).`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** The Jira sites the connected account can open. */
export async function jiraSites(userId: string): Promise<JiraSite[]> {
  if (jiraFake) return [FAKE_SITE];
  const token = await accessToken(userId);
  const sites = await call<{ id: string; name: string; url: string; scopes: string[] }[]>(token, `${API}/oauth/token/accessible-resources`);
  return sites.filter((s) => s.scopes.includes("read:jira-work")).map(({ id, name, url }) => ({ id, name, url }));
}

// ---------------------------------------------------------------------------
// Reading issues
// ---------------------------------------------------------------------------

type FieldIds = { storyPoints: string[]; acceptanceCriteria: string | null };

/** Story points and acceptance criteria are custom fields with site-specific ids, found by name. */
async function fieldIds(token: string, cloudId: string): Promise<FieldIds> {
  const fields = await call<{ id: string; name: string; custom: boolean; schema?: { type?: string } }[]>(
    token,
    `${siteApi(cloudId)}/field`,
  );
  const named = (pattern: RegExp) => fields.filter((f) => f.custom && pattern.test(f.name.trim()));
  return {
    storyPoints: named(/^story points?$|^story point estimate$/i).map((f) => f.id),
    acceptanceCriteria: named(/^acceptance criteria$/i).find((f) => f.schema?.type === "string")?.id ?? null,
  };
}

type RawIssue = { key: string; fields: Record<string, unknown> };
const text = (v: unknown) => (typeof v === "string" ? v : "");
const named = (v: unknown) => (v && typeof v === "object" && "name" in v ? text((v as { name: unknown }).name) : "");

function toIssue(raw: RawIssue, ids: FieldIds): JiraIssue {
  const f = raw.fields;
  const points = ids.storyPoints.map((id) => f[id]).find((v) => typeof v === "number");
  const parent = f.parent as { fields?: { summary?: unknown } } | undefined;
  return {
    key: raw.key,
    summary: text(f.summary),
    description: text(f.description),
    acceptanceCriteria: ids.acceptanceCriteria ? text(f[ids.acceptanceCriteria]) : "",
    storyPoints: typeof points === "number" ? points : null,
    status: named(f.status),
    issueType: named(f.issuetype),
    parent: text(parent?.fields?.summary),
    labels: Array.isArray(f.labels) ? f.labels.filter((l): l is string => typeof l === "string") : [],
    created: text(f.created) || null,
  };
}

function searchFields(ids: FieldIds): string[] {
  const fields = ["summary", "description", "status", "issuetype", "parent", "labels", "created", ...ids.storyPoints];
  if (ids.acceptanceCriteria) fields.push(ids.acceptanceCriteria);
  return fields;
}

/**
 * Runs a JQL search and returns up to JIRA_MAX_ISSUES issues, in Jira's order.
 * With a `deadline` (ms since epoch), it stops asking for more pages once that
 * has passed and says the list was cut short, so a slow Jira can't run a nightly
 * sync past the time the server allows.
 */
export async function searchJira(
  userId: string,
  cloudId: string,
  jql: string,
  { deadline }: { deadline?: number } = {},
): Promise<{ issues: JiraIssue[]; truncated: boolean }> {
  if (jiraFake) return { issues: fakeSearch(userId, jql), truncated: false };
  const token = await accessToken(userId);
  const ids = await fieldIds(token, cloudId);
  const fields = searchFields(ids);

  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await call<{ issues: RawIssue[]; nextPageToken?: string; isLast?: boolean }>(
      token,
      `${siteApi(cloudId)}/search/jql`,
      { method: "POST", body: JSON.stringify({ jql, fields, maxResults: 100, ...(nextPageToken && { nextPageToken }) }) },
    );
    issues.push(...page.issues.map((raw) => toIssue(raw, ids)));
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken && issues.length < JIRA_MAX_ISSUES && !(deadline && Date.now() > deadline));
  return { issues: issues.slice(0, JIRA_MAX_ISSUES), truncated: Boolean(nextPageToken) };
}

/**
 * Looks issues up by key, 100 at a time: those a project already has but its
 * search no longer finds (finished, moved to another sprint). Keys Jira doesn't
 * have any more are simply missing from the result.
 */
export async function jiraIssuesByKey(
  userId: string,
  cloudId: string,
  keys: string[],
  { deadline }: { deadline?: number } = {},
): Promise<{ issues: JiraIssue[]; complete: boolean }> {
  const valid = [...new Set(keys.filter(isJiraKey).map((k) => k.toUpperCase()))];
  const issues: JiraIssue[] = [];
  for (let i = 0; i < valid.length; i += 100) {
    if (deadline && Date.now() > deadline) return { issues, complete: false };
    const { issues: found } = await searchJira(userId, cloudId, `key in (${valid.slice(i, i + 100).join(",")})`, { deadline });
    issues.push(...found);
  }
  return { issues, complete: true };
}

// ---------------------------------------------------------------------------
// Writing back
// ---------------------------------------------------------------------------

/** The token and field ids a run of writes shares, so sending 50 stories doesn't fetch them 50 times. */
export type JiraWriter = { token: string; ids: FieldIds };

export async function jiraWriter(userId: string, cloudId: string): Promise<JiraWriter> {
  if (jiraFake) return { token: "fake-token", ids: { storyPoints: ["storyPoints"], acceptanceCriteria: "acceptanceCriteria" } };
  const token = await accessToken(userId);
  return { token, ids: await fieldIds(token, cloudId) };
}

/** Jira's limit for an issue's summary. */
export const JIRA_TITLE_MAX = 255;

/** One issue as Sprintwise would store it: cut to fit, criteria moved out of long descriptions. */
export function jiraView(issue: JiraIssue): JiraText {
  const table = readCsvTable(issuesAsCsv([issue]), { maxBytes: Number.MAX_SAFE_INTEGER, maxRows: 1 });
  const row = table.ok ? table.rows[0] : undefined;
  if (!row) return { title: issue.summary, description: issue.description, acceptanceCriteria: issue.acceptanceCriteria, storyPoints: issue.storyPoints };
  return baseOf(row.story);
}

export type SendResult = {
  /** Written to Jira. */
  sent: JiraField[];
  /** Changed in Jira too since Sprintwise last read it: not sent, so nobody's work is overwritten. */
  conflicts: JiraField[];
  /** Jira doesn't allow the field on this issue type. */
  notAllowed: JiraField[];
  /** Too long for Jira, or text Sprintwise only holds part of: sending would cut Jira's copy short. */
  tooLong: JiraField[];
  criteriaInDescription: boolean;
  /** What to remember as Jira's version from now on (see mergeEdited). */
  base: JiraText;
};

/**
 * Sends a story's edits to its Jira issue: reads the issue first, then writes
 * only the fields edited here (planSend), each where this issue type allows it.
 * Points go to whichever story points field the issue uses. With no criteria
 * field, criteria go into the description's "Acceptance criteria" section, in
 * Jira's current description, so the rest of it is left as it is.
 */
export async function sendStoryToJira(
  userId: string,
  cloudId: string,
  story: JiraText & { key: string },
  base: JiraText | null,
  writer?: JiraWriter,
): Promise<SendResult> {
  if (!isJiraKey(story.key) && !jiraFake) throw new JiraError(`${cutText(story.key, 60)} isn't a Jira issue key, so it can't be sent.`);
  const { token, ids } = writer ?? (await jiraWriter(userId, cloudId));

  // Jira's issue now, and which of its fields can be edited.
  let current: JiraIssue;
  let editable: (fieldId: string) => boolean;
  /** The story points field this issue keeps its estimate in, if any. */
  let holding: string | undefined;
  let write: (fields: Record<string, unknown>) => Promise<void>;
  if (jiraFake) {
    const issue = fakeIssue(userId, story.key);
    if (!issue) throw new JiraError(`Jira has no issue ${story.key}.`);
    current = issue;
    editable = () => true;
    holding = "storyPoints";
    write = async (fields) => {
      fakeChange(userId, story.key, fields as Partial<JiraIssue>);
    };
  } else {
    const url = `${siteApi(cloudId)}/issue/${encodeURIComponent(story.key)}`;
    const fields = ["summary", "description", ...ids.storyPoints, ...(ids.acceptanceCriteria ? [ids.acceptanceCriteria] : [])];
    const raw = await call<RawIssue & { editmeta?: { fields?: Record<string, unknown> } }>(
      token,
      `${url}?fields=${fields.map(encodeURIComponent).join(",")}&expand=editmeta`,
    );
    current = toIssue({ key: raw.key, fields: raw.fields }, ids);
    holding = ids.storyPoints.find((id) => typeof raw.fields[id] === "number");
    const meta = raw.editmeta?.fields;
    editable = (fieldId) => !meta || fieldId in meta;
    write = (fields) => call<void>(token, `${url}?notifyUsers=false`, { method: "PUT", body: JSON.stringify({ fields }) });
  }

  const view = jiraView(current);
  const plan = planSend(story, base, view);
  const result: SendResult = { sent: [], conflicts: plan.conflicts, notAllowed: [], tooLong: [], criteriaInDescription: false, base: view };
  const out: Record<string, unknown> = {};
  const wasCut = (field: JiraField) =>
    field !== "storyPoints" && (String(story[field]).includes(JIRA_CUT) || String(base?.[field] ?? "").includes(JIRA_CUT));

  let description: string | undefined;
  for (const field of plan.send) {
    if (field === "title") {
      if (story.title.length > JIRA_TITLE_MAX || wasCut("title")) result.tooLong.push("title");
      else {
        out.summary = story.title;
        result.sent.push("title");
      }
    } else if (field === "description") {
      if (wasCut("description")) result.tooLong.push("description");
      else {
        description = story.description;
        result.sent.push("description");
      }
    } else if (field === "storyPoints") {
      // Sites often have two points fields ("Story Points" and "Story point estimate"): use the one this
      // issue holds a value in, else the first its type can edit.
      const usable = ids.storyPoints.filter(editable);
      const target = usable.find((id) => id === holding) ?? usable[0];
      if (!target) result.notAllowed.push("storyPoints");
      else {
        out[target] = story.storyPoints;
        result.sent.push("storyPoints");
      }
    }
  }
  if (plan.send.includes("acceptanceCriteria")) {
    const criteriaField = ids.acceptanceCriteria && editable(ids.acceptanceCriteria) ? ids.acceptanceCriteria : null;
    if (wasCut("acceptanceCriteria")) result.tooLong.push("acceptanceCriteria");
    else if (criteriaField) {
      out[criteriaField] = story.acceptanceCriteria;
      result.sent.push("acceptanceCriteria");
    } else if (story.acceptanceCriteria.trim() !== "") {
      // Into the description being sent, or Jira's own (full, current) one.
      description = withCriteriaInDescription(description ?? current.description, story.acceptanceCriteria);
      result.criteriaInDescription = true;
      result.sent.push("acceptanceCriteria");
    } else if (result.sent.includes("description")) {
      // Criteria kept in the description travel with it.
      result.sent.push("acceptanceCriteria");
    } else if (result.tooLong.includes("description")) {
      result.tooLong.push("acceptanceCriteria");
    } else {
      result.conflicts.push("acceptanceCriteria");
    }
  }
  if (description !== undefined) out.description = description;
  if (Object.keys(out).length > 0) await write(out);

  // Jira's version from now on: what was sent is now in Jira; anything else stays as it was remembered,
  // so a field edited here and not sent still counts as edited.
  const remembered = base ?? story;
  const next = { ...baseOf(remembered) } as Record<JiraField, unknown>;
  for (const field of JIRA_FIELDS) {
    if (result.sent.includes(field)) next[field] = story[field];
    else if (!base && (result.conflicts.includes(field) || result.notAllowed.includes(field) || result.tooLong.includes(field))) next[field] = view[field];
  }
  result.base = next as JiraText;
  return result;
}

// ---------------------------------------------------------------------------
// Into the import pipeline
// ---------------------------------------------------------------------------

const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Ends text cut to fit Sprintwise's limits. A story holding it isn't sent back, so Jira keeps its full text. */
export const JIRA_CUT = "… [cut short here; the full text is in Jira]";

/** Jira allows longer text than Sprintwise keeps: cut it rather than leave the issue out of imports and syncs. */
function fit(text: string, limit: number): string {
  return text.length <= limit ? text : cutText(text, limit - JIRA_CUT.length) + JIRA_CUT;
}

/**
 * Jira issues as a CSV with Jira's own column names, so they go through exactly
 * the same preview, checks and import as a file would.
 */
export function issuesAsCsv(issues: JiraIssue[]): string {
  const labelColumns = Math.max(1, ...issues.map((i) => i.labels.length));
  const header = [
    "Issue key",
    "Summary",
    "Issue Type",
    "Description",
    "Acceptance Criteria",
    "Story Points",
    "Status",
    "Parent summary",
    ...Array.from({ length: labelColumns }, () => "Labels"),
  ];
  const rows = issues.map((i) => {
    // A description too long to keep may have its criteria at the end, past the cut: those move to the
    // criteria column first, so the story isn't scored as having none.
    const moved = i.description.length > STORY_LIMITS.description && !i.acceptanceCriteria.trim() ? criteriaFromDescription(i.description) : "";
    return [
      i.key,
      fit(i.summary, STORY_LIMITS.title),
      fit(i.issueType, STORY_LIMITS.issueType),
      fit(i.description, STORY_LIMITS.description),
      fit(moved || i.acceptanceCriteria, STORY_LIMITS.acceptanceCriteria),
      i.storyPoints === null || i.storyPoints > STORY_LIMITS.points ? "" : String(i.storyPoints),
      fit(i.status, STORY_LIMITS.status),
      fit(i.parent, EPIC_MAX_LENGTH),
      ...Array.from({ length: labelColumns }, (_, n) => i.labels[n] ?? ""),
    ]
      .map(cell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
