import { Download } from "lucide-react";
import type { Metadata } from "next";
import { ImportForm } from "@/app/projects/_components/import-form";
import { SectionHeader } from "@/components/section-header";
import { MAX_ROWS, TEMPLATE_COLUMNS } from "@/lib/csv/template";
import { requireProject } from "@/lib/server/dal";
import { settingsOf } from "@/lib/server/readiness";

export const metadata: Metadata = { title: "Import CSV" };

export default async function ImportPage({ params }: PageProps<"/projects/[projectId]/import">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <SectionHeader
        title="Import stories from CSV"
        description={`Up to ${MAX_ROWS} rows and 1 MB. Jira exports work too. Stories whose key is already in the project are updated.`}
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
          {TEMPLATE_COLUMNS.map((c) => (
            <code key={c} className="mx-0.5 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
              {c}
            </code>
          ))}
          . Only <code className="font-mono text-xs">key</code> and <code className="font-mono text-xs">title</code> are required.
        </p>
        <ImportForm projectId={project.id} settings={settingsOf(project)} />
      </div>
    </>
  );
}
