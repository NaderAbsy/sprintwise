import Link from "next/link";
import { SignInButton } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";
import { MarketingNav } from "@/components/shell/marketing-nav";
import { ThemeToggle } from "@/components/theme";
import { getSession } from "@/lib/server/dal";
import { FEEDBACK_URL, GITHUB_URL, MARKETING_LINKS } from "@/lib/site";

/** Public pages: a sticky top bar with the site's tabs, the page, and a footer with every link. */
export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const account = session ? (
    <Link href="/projects" className="btn-primary">
      Open app
    </Link>
  ) : (
    <SignInButton className="btn-primary" />
  );
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/75 backdrop-blur-lg">
        <nav aria-label="Main" className="relative mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <MarketingNav
            actions={
              <>
                <div className="hidden md:block">
                  <ThemeToggle />
                </div>
                <div className={session ? "" : "hidden sm:block"}>{account}</div>
              </>
            }
            menuExtras={
              <>
                <div className="flex items-center justify-between gap-3 px-3">
                  <span className="text-sm text-muted">Theme</span>
                  <ThemeToggle />
                </div>
                {!session && <div className="px-3 sm:hidden">{account}</div>}
              </>
            }
          />
        </nav>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="no-print border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-muted">
              Checks that stories are ready before a sprint, then measures how much the sprint changes. A portfolio
              project; all sample data is invented.
            </p>
          </div>
          <div>
            <p className="font-medium">Site</p>
            <ul className="mt-3 space-y-2 text-muted">
              {MARKETING_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium">More</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li>
                <a href={GITHUB_URL} className="hover:text-foreground">
                  Code on GitHub
                </a>
              </li>
              <li>
                <a href="/template.csv" className="hover:text-foreground">
                  CSV template
                </a>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-foreground">
                  Changelog
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  Send feedback<span className="sr-only"> (opens GitHub in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
