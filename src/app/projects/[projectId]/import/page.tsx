import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/app/projects/_components/import-form";
import { MAX_ROWS, TEMPLATE_COLUMNS } from "@/lib/csv/template";
import { requireProject } from "@/lib/server/dal";
import { settingsOf } from "@/lib/server/readiness";

export const metadata: Metadata = { title: "Import CSV" };

export default async function ImportPage({ params }: PageProps<"/projects/[projectId]/import">) {
  const project = await requireProject((await params).projectId);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Import stories from CSV</h1>
        <p className="mt-2 text-muted">
          Columns:{" "}
          {TEMPLATE_COLUMNS.map((c) => (
            <code key={c} className="mx-0.5 rounded bg-border px-1 text-xs">
              {c}
            </code>
          ))}
          . Only key and title are required. Up to {MAX_ROWS} rows and 1 MB. Jira exports work too. Stories whose key is
          already in the project are updated.
        </p>
        <a href="/template.csv" download className="mt-2 inline-block text-sm text-accent underline">
          Download the template
        </a>
      </div>
      <ImportForm projectId={project.id} settings={settingsOf(project)} />
    </div>
  );
}
