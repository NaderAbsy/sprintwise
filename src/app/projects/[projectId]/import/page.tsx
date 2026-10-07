import { Fragment } from "react";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { ImportForm } from "@/app/projects/_components/import-form";
import { SectionHeader } from "@/components/section-header";
import { rememberedColumns } from "@/lib/csv/parse";
import { IMPORT_FILE_ROWS, IMPORT_MAX_STORIES, TEMPLATE_COLUMNS } from "@/lib/csv/template";
import { db } from "@/lib/server/db";
import { requireProject, requireUser } from "@/lib/server/dal";
import { JiraError, jiraAccount, jiraConfigured, jiraSites, type JiraSite } from "@/lib/server/jira";
import { settingsOf } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage({ params }: PageProps<"/projects/[projectId]/import">) {
  const project = await requireProject((await params).projectId);
  const user = await requireUser();
  const edited = await db.story.findMany({ where: { projectId: project.id, editedAt: { not: null } }, select: { key: true } });
  const jira = jiraConfigured ? await jiraState(user.id, project) : undefined;
  return (
    <>
      <SectionHeader
        title="Import stories"
        description={`${jiraConfigured ? "From a Jira search or a CSV file" : "From a CSV file"} of up to ${IMPORT_FILE_ROWS.toLocaleString("en")} stories, Jira exports included. Tick the stories you want, up to ${IMPORT_MAX_STORIES} at a time. Stories whose key is already in the project are updated.`}
        actions={
          <a href="/template.csv" download className="btn-secondary">
            <Download aria-hidden="true" className="h-4 w-4" />
            Download the template
          </a>
        }
      />
      <div className="max-w-4xl space-y-4">
        <p className="text-sm text-muted">
          Columns:{" "}
          {/* Spaces between the names let the line wrap on phones. */}
          {TEMPLATE_COLUMNS.map((c, i) => (
            <Fragment key={c}>
              {i > 0 && " "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">{c}</code>
            </Fragment>
          ))}
          . Only <code className="font-mono text-xs">key</code> and <code className="font-mono text-xs">title</code> are required.
          Jira&apos;s Issue Type, Parent or Epic, and Labels columns are read too.
        </p>
        <ImportForm
          projectId={project.id}
          settings={settingsOf(project)}
          savedColumns={rememberedColumns(project.importColumns)}
          doneStatuses={doneStatusesOf(project)}
          editedKeys={edited.map((s) => s.key)}
          jira={jira}
        />
      </div>
    </>
  );
}

/** Whether this account has connected Jira, which sites it can read, and the project's saved search. */
async function jiraState(userId: string, project: { jiraCloudId: string | null; jiraJql: string | null }) {
  const connected = Boolean(await jiraAccount(userId));
  let sites: JiraSite[] = [];
  let sitesError: string | undefined;
  if (connected) {
    try {
      sites = await jiraSites(userId);
    } catch (error) {
      sitesError = error instanceof JiraError ? error.message : "Couldn't reach Jira to list your sites.";
    }
  }
  return {
    connected,
    sites,
    sitesError,
    cloudId: project.jiraCloudId,
    jql: project.jiraJql,
    suggestedJql: "project = ABC AND statusCategory != Done ORDER BY Rank ASC",
  };
}
