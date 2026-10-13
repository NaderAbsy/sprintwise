import Link from "next/link";

/** Under a shared report or backlog: what made it, for a viewer who'd like the same for their own team. Not printed. */
export function SharedFooter({ wide = false }: { wide?: boolean }) {
  return (
    <aside aria-label="About Sprintwise" className={`no-print mx-auto mt-10 ${wide ? "max-w-4xl" : "max-w-3xl"}`}>
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5 text-sm">
        <p className="text-muted">
          <span className="font-medium text-foreground">Made with Sprintwise.</span> Check your own stories before the sprint
          starts, and see how much it changed after. Free, with fixed rules and no AI reading your tickets.
        </p>
        <Link href="/demo" className="btn-secondary btn-sm">
          Try the demo
        </Link>
      </div>
    </aside>
  );
}
