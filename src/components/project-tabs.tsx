"use client";
import { FileUp, LineChart, ListChecks, Settings, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/** The project's sections. Stories count as Backlog; a sprint's pages count as Sprints. */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  // The tab just clicked lights up at once, while its page loads; once the address changes, the
  // address decides again.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const pending = clicked && clicked.from === pathname ? clicked.href : null;
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Backlog", Icon: ListChecks, active: pathname === base || pathname.startsWith(`${base}/stories`) },
    { href: `${base}/sprints`, label: "Sprints", Icon: Timer, active: pathname.startsWith(`${base}/sprints`) },
    { href: `${base}/trends`, label: "Trends", Icon: LineChart, active: pathname.startsWith(`${base}/trends`) },
    { href: `${base}/import`, label: "Import", Icon: FileUp, active: pathname.startsWith(`${base}/import`) },
    { href: `${base}/settings`, label: "Settings", Icon: Settings, active: pathname.startsWith(`${base}/settings`) },
  ].map((tab) => ({ ...tab, active: pending ? tab.href === pending : tab.active }));
  return (
    <nav aria-label="Project sections" className="no-print -mb-px flex gap-1 overflow-x-auto">
      {tabs.map(({ href, label, Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={(event) => {
            // Opening in a new tab or window doesn't change this page.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            setClicked({ href, from: pathname });
          }}
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
