import { Sidebar } from "@/components/shell/sidebar";
import { db } from "@/lib/server/db";
import { getSession } from "@/lib/server/dal";

/**
 * Signed-in pages: a sidebar with every project, and the page beside it.
 * Pages still check sign-in and ownership themselves (dal.ts); this only lays out.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const projects = session
    ? await db.project.findMany({
        where: { userId: session.user.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* The column carries the sidebar's background for the full page height; the sidebar itself stays sticky. */}
      <div className="lg:border-r lg:border-border lg:bg-surface">
        <Sidebar projects={projects} user={session ? { name: session.user.name, image: session.user.image ?? null } : null} />
      </div>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
