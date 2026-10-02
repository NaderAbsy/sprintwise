import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** Breadcrumbs, title, one line of context and the page's main actions, the same on every page. */
export function PageHeader({
  crumbs = [],
  title,
  description,
  actions,
}: {
  crumbs?: Crumb[];
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="no-print mb-6 space-y-3">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {crumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-subtle" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="rounded hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <div className="text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
