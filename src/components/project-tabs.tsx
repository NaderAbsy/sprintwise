"use client";
import { FileUp, ListChecks, Settings, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The project's sections. Stories count as Backlog; a sprint's pages count as Sprints. */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Backlog", Icon: ListChecks, active: pathname === base || pathname.startsWith(`${base}/stories`) },
    { href: `${base}/sprints`, label: "Sprints", Icon: Timer, active: pathname.startsWith(`${base}/sprints`) },
    { href: `${base}/import`, label: "Import", Icon: FileUp, active: pathname.startsWith(`${base}/import`) },
    { href: `${base}/settings`, label: "Settings", Icon: Settings, active: pathname.startsWith(`${base}/settings`) },
  ];
  return (
    <nav aria-label="Project sections" className="no-print -mb-px flex gap-1 overflow-x-auto">
      {tabs.map(({ href, label, Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
            active ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
