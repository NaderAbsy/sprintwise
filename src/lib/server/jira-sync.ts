import "server-only";
import type { Project } from "@/generated/prisma/client";
import { readCsvTable } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { MAX_STORIES_PER_PROJECT } from "@/lib/limits";
import { db } from "@/lib/server/db";
import { isJiraKey, issuesAsCsv, JIRA_MAX_ISSUES, JiraError, jiraIssuesByKey, searchJira, type JiraIssue } from "@/lib/server/jira";
import { saveStories } from "@/lib/server/save-stories";
import { LimitError } from "@/lib/server/within-limit";
import { doneStatusesOf } from "@/lib/server/sprint";
import { recordSprintChanges } from "@/lib/server/tracking";
import { isDone } from "@/lib/sprint/metrics";
import { wantedByDefault } from "@/lib/csv/import";

/**
 * A project reads from and writes to one Jira site. Importing from another would make
 * Send to Jira write to the new site, possibly over a different team's issue with the same key.
 */
export function otherSite(project: Pick<Project, "jiraCloudId" | "jiraSiteName">, cloudId: string): string | null {
  if (!project.jiraCloudId || project.jiraCloudId === cloudId) return null;
  return `This project already imports from ${project.jiraSiteName ?? "another Jira site"}, and Send to Jira writes there. To bring in issues from this site, create a new project for it.`;
}

export const jiraFailure = (error: unknown) =>
  error instanceof JiraError ? error.message : "Couldn't reach Jira. Check your connection and try again.";

/** A project's left-out keys (see Project.jiraLeftOut), or null for projects imported before they were kept. */
export function leftOutKeys(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  return new Set(value.filter((k): k is string => typeof k === "string").map((k) => k.toUpperCase()));
}

/** At most this many stories the search no longer finds are looked up by key in one sync. */
const LOOKUP_MAX = 500;

/**
 * Runs the project's saved search again with `userId`'s Jira connection: updates
 * stories that came from Jira and adds new ones. Stories the search no longer
 * finds (finished, or moved out of it) are looked up by key, so a story finished
 * in Jira is finished here too. A story edited here keeps its edits, field by
 * field (see saveStories), and still takes Jira's status. Issues left unticked
 * at import, or deleted here, aren't added again; nor are new issues that are
 * already finished, or epics or sub-tasks. Then any sprint that follows the
 * backlog records the day's changes. Used by Sync from Jira and by the nightly
 * sync (`automatic`, with a `deadline` for the Jira requests). Callers check
 * ownership first.
 */
export async function syncProjectFromJira(
  project: Project,
  userId: string,
  { automatic = false, deadline }: { automatic?: boolean; deadline?: number } = {},
): Promise<FormState> {
  if (!project.jiraCloudId || !project.jiraJql)
    return { error: "Import from Jira once first, so Sprintwise knows which search to run." };

  const existing = new Map(
    (
      await db.story.findMany({ where: { projectId: project.id }, select: { key: true, status: true, jiraBase: true } })
    ).map((s) => [s.key, s]),
  );
  const doneStatuses = doneStatusesOf(project);

  let issues: JiraIssue[];
  let truncated: boolean;
  let gone = 0;
  let lookedUp = true;
  // Issues created after the search starts are added next time, so it's the search's time that's saved.
  const searchedAt = new Date();
  try {
    ({ issues, truncated } = await searchJira(userId, project.jiraCloudId, project.jiraJql, { deadline }));
    // Stories from Jira that the search didn't return: finished since, or moved out of the search.
    const found = new Set(issues.map((i) => i.key.trim().toUpperCase()));
    // Only keys of this Jira's projects: a story written here (STORY-3) was never in Jira.
    const prefix = (key: string) => key.slice(0, key.lastIndexOf("-"));
    const prefixes = new Set([...found, ...[...existing.values()].filter((s) => s.jiraBase !== null).map((s) => s.key)].map(prefix));
    const missing = [...existing.values()]
      .filter((s) => isJiraKey(s.key) && prefixes.has(prefix(s.key)) && !found.has(s.key) && !isDone(s.status, doneStatuses))
      .map((s) => s.key)
      .slice(0, LOOKUP_MAX);
    if (missing.length > 0 && !truncated) {
      const byKey = await jiraIssuesByKey(userId, project.jiraCloudId, missing, { deadline });
      const back = byKey.issues.filter((i) => missing.includes(i.key.trim().toUpperCase()));
      issues = [...issues, ...back];
      lookedUp = byKey.complete;
      if (byKey.complete) gone = missing.length - back.length;
    }
  } catch (error) {
    return { error: jiraFailure(error) };
  }
  const csv = issuesAsCsv(issues);
  const created = new Map(issues.map((i) => [i.key.trim().toUpperCase(), i.created]));

  // Issues left out at import or deleted here stay out. Projects imported before that list was kept
  // treat any issue created before the last sync as left out.
  const leftOutList = leftOutKeys(project.jiraLeftOut);
  const since = project.jiraSyncedAt;
  const leftOutOnPurpose = (key: string) => {
    if (leftOutList) return leftOutList.has(key);
    const at = created.get(key);
    return Boolean(since && at && new Date(at) <= since);
  };
  const table = readCsvTable(csv, { maxBytes: Number.MAX_SAFE_INTEGER, maxRows: JIRA_MAX_ISSUES + LOOKUP_MAX });
  if (!table.ok) return { error: table.errors[0]?.message ?? "Jira's issues couldn't be read." };

  let problems = 0;
  let leftOut = 0;
  const stories = table.rows.flatMap((row) => {
    if (row.errors.length > 0) {
      problems++;
      return [];
    }
    const current = existing.get(row.story.key);
    // New issues that import wouldn't tick (finished, epics, sub-tasks) stay out; one ticked in at import keeps syncing.
    if (!current && !wantedByDefault(row.story, doneStatuses)) return [];
    if (!current && leftOutOnPurpose(row.story.key)) {
      leftOut++;
      return [];
    }
    return [{ ...row.story, epic: row.epic, issueType: row.story.issueType ?? "" }];
  });
  const added = stories.filter((s) => !existing.has(s.key)).length;
  if (existing.size + added > MAX_STORIES_PER_PROJECT) {
    return {
      error: `Syncing would take the project past ${MAX_STORIES_PER_PROJECT} stories. Narrow the Jira search on the Import page.`,
    };
  }

  let result: Awaited<ReturnType<typeof saveStories>>;
  try {
    result = await saveStories(project, stories, {
      merge: true,
      fromJira: true,
      maxStories: MAX_STORIES_PER_PROJECT,
      extra: (tx) =>
        tx.project.update({
          where: { id: project.id },
          data: { jiraSyncedAt: searchedAt, jiraAutoSynced: automatic, jiraSyncError: null },
        }),
    });
  } catch (error) {
    if (error instanceof LimitError) return { error: error.message };
    // Nothing was saved: the transaction rolled back.
    console.error("Sync from Jira couldn't save", { projectId: project.id, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
    return { error: "Jira's issues were read, but saving them failed, so nothing changed. Try again in a minute." };
  }
  await recordSprintChanges(project.id);
  const kept = result.stillEdited;
  const parts = [`Synced from Jira: ${result.saved.size - added} updated, ${added} added.`];
  if (kept > 0)
    parts.push(
      `${kept} edited here kept ${kept === 1 ? "its" : "their"} edits (Jira's other changes came in); send ${kept === 1 ? "it" : "them"} to Jira when ready.`,
    );
  if (gone > 0)
    parts.push(`${gone} ${gone === 1 ? "story isn't" : "stories aren't"} in Jira any more (deleted or moved to another project), so ${gone === 1 ? "it wasn't" : "they weren't"} updated.`);
  if (truncated) parts.push(`The search found more than Sprintwise reads at once, so only the first ${JIRA_MAX_ISSUES.toLocaleString("en")} were synced. Narrow the search on the Import page.`);
  else if (!lookedUp) parts.push("Jira was slow, so some stories the search no longer finds weren't checked; they will be next time.");
  if (problems > 0) parts.push(`${problems} couldn't be read (for example, no title).`);
  if (leftOut > 0)
    parts.push(
      `${leftOut} left out at import or deleted here ${leftOut === 1 ? "wasn't" : "weren't"} added; import ${leftOut === 1 ? "it" : "them"} from the Import page if you want ${leftOut === 1 ? "it" : "them"}.`,
    );
  return { message: parts.join(" ") };
}

/**
 * Stories deleted here stay out of later syncs: their keys join the project's
 * left-out list (projects from before that list was kept already leave out
 * anything older than the last sync). One statement, so deletes at the same
 * moment don't lose each other's keys.
 */
export async function leaveOutOfSync(projectId: string, keys: string[]) {
  if (keys.length === 0) return;
  await db.$executeRaw`
    UPDATE projects SET "jiraLeftOut" = "jiraLeftOut" || ${JSON.stringify(keys)}::jsonb
    WHERE id = ${projectId} AND "jiraCloudId" IS NOT NULL AND jsonb_typeof("jiraLeftOut") = 'array'`;
}
