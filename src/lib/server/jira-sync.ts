import "server-only";
import type { Project } from "@/generated/prisma/client";
import { readCsvTable } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { MAX_STORIES_PER_PROJECT } from "@/lib/limits";
import { db } from "@/lib/server/db";
import { issuesAsCsv, JIRA_MAX_ISSUES, JiraError, searchJira } from "@/lib/server/jira";
import { saveStories } from "@/lib/server/save-stories";
import { doneStatusesOf } from "@/lib/server/sprint";
import { recordSprintChanges } from "@/lib/server/tracking";
import { isDone } from "@/lib/sprint/metrics";
import { isEpic, isSubtask } from "@/lib/stories/types";

export const jiraFailure = (error: unknown) =>
  error instanceof JiraError ? error.message : "Couldn't reach Jira. Check your connection and try again.";

/**
 * Runs the project's saved search again with `userId`'s Jira connection: updates
 * stories that came from Jira and adds new ones. Stories edited here and not yet
 * sent to Jira are left alone, and new issues that are already finished, or
 * are epics or sub-tasks, aren't added. Then any sprint that follows the backlog records the day's changes.
 * Used by Sync from Jira and by the nightly sync (`automatic`). Callers check
 * ownership first.
 */
export async function syncProjectFromJira(project: Project, userId: string, { automatic = false } = {}): Promise<FormState> {
  if (!project.jiraCloudId || !project.jiraJql) return { error: "Import from Jira once first, so Sprintwise knows which search to run." };

  let csv: string;
  let created: Map<string, string | null>;
  // Issues created after the search starts are added next time, so it's the search's time that's saved.
  const searchedAt = new Date();
  try {
    const { issues } = await searchJira(userId, project.jiraCloudId, project.jiraJql);
    csv = issuesAsCsv(issues);
    created = new Map(issues.map((i) => [i.key.trim().toUpperCase(), i.created]));
  } catch (error) {
    return { error: jiraFailure(error) };
  }
  // New issues are ones created since the last import or sync; older ones missing here were left out on purpose.
  const since = project.jiraSyncedAt;
  const isNew = (key: string) => {
    const at = created.get(key);
    return !since || !at || new Date(at) > since;
  };
  const table = readCsvTable(csv, { maxBytes: Number.MAX_SAFE_INTEGER, maxRows: JIRA_MAX_ISSUES });
  if (!table.ok) return { error: table.errors[0]?.message ?? "Jira's issues couldn't be read." };

  const existing = new Map(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true, editedAt: true } })).map((s) => [s.key, s]),
  );
  const doneStatuses = doneStatusesOf(project);
  let kept = 0;
  let problems = 0;
  let leftOut = 0;
  const stories = table.rows.flatMap((row) => {
    if (row.errors.length > 0) {
      problems++;
      return [];
    }
    const current = existing.get(row.story.key);
    if (current?.editedAt) {
      kept++;
      return [];
    }
    if (!current && isDone(row.story.status, doneStatuses)) return [];
    // New epics and sub-tasks stay out, as at import; one ticked in at import keeps syncing.
    if (!current && (isEpic(row.story.issueType) || isSubtask(row.story.issueType))) return [];
    if (!current && !isNew(row.story.key)) {
      leftOut++;
      return [];
    }
    return [{ ...row.story, epic: row.epic, issueType: row.story.issueType ?? "" }];
  });
  const added = stories.filter((s) => !existing.has(s.key)).length;
  if (existing.size + added > MAX_STORIES_PER_PROJECT) {
    return { error: `Syncing would take the project past ${MAX_STORIES_PER_PROJECT} stories. Narrow the Jira search on the Import page.` };
  }

  const saved = await saveStories(project, stories, {
    keepEdited: true,
    extra: (tx) =>
      tx.project.update({
        where: { id: project.id },
        data: { jiraSyncedAt: searchedAt, jiraAutoSynced: automatic, jiraSyncError: null },
      }),
  });
  // A story edited here while Jira was being read is kept too.
  kept += stories.length - saved.size;
  await recordSprintChanges(project.id);
  const parts = [`Synced from Jira: ${saved.size - added} updated, ${added} added.`];
  if (kept > 0) parts.push(`${kept} edited here ${kept === 1 ? "was" : "were"} left as ${kept === 1 ? "it is" : "they are"}; send ${kept === 1 ? "it" : "them"} to Jira first.`);
  if (problems > 0) parts.push(`${problems} couldn't be read (for example, no title).`);
  if (leftOut > 0) parts.push(`${leftOut} left out at import ${leftOut === 1 ? "wasn't" : "weren't"} added; import ${leftOut === 1 ? "it" : "them"} from the Import page if you want ${leftOut === 1 ? "it" : "them"}.`);
  return { message: parts.join(" ") };
}
