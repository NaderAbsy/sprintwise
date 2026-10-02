import Link from "next/link";
import { SignInButton } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { getSession } from "@/lib/server/dal";

/** Public pages: a slim top bar, the page, a quiet footer. */
export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/demo" className="btn-ghost">
              Demo
            </Link>
            <ThemeToggle className="hidden sm:inline-flex" />
            {session ? (
              <Link href="/projects" className="btn-primary">
                Open app
              </Link>
            ) : (
              <SignInButton className="btn-primary" />
            )}
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="no-print border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-6">
          <p>Sprintwise · a portfolio project. All sample data is invented.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <ThemeToggle className="sm:hidden" />
          </div>
        </div>
      </footer>
    </div>
  );
}
