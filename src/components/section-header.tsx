import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/** The heading of a page inside a project: an optional back link, the page title, context and actions. */
export function SectionHeader({
  back,
  title,
  description,
  actions,
}: {
  back?: { href: string; label: string };
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="no-print mb-6 space-y-2">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1.5 rounded text-sm text-muted hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <div className="text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
