import Link from "next/link";
import { HeaderAccount, MenuAccount } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";
import { MarketingNav } from "@/components/shell/marketing-nav";
import { ThemeToggle } from "@/components/theme";
import { FEEDBACK_URL, AUTHOR, GITHUB_URL, MARKETING_LINKS } from "@/lib/site";

/**
 * Public pages: a sticky top bar with the site's tabs, the page, and a footer with every link.
 * Nothing here reads the request (the account button asks in the browser), so the pages are cached.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
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
                <HeaderAccount />
              </>
            }
            menuExtras={
              <>
                <div className="flex items-center justify-between gap-3 px-3">
                  <span className="text-sm text-muted">Theme</span>
                  <ThemeToggle />
                </div>
                <MenuAccount />
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
              Checks that stories are ready before a sprint, then measures how much the sprint changes. Free to use;
              all sample data is invented.
            </p>
            <p className="text-muted">
              Made by{" "}
              <a href={AUTHOR.url} className="underline underline-offset-2 hover:text-foreground">
                {AUTHOR.name}
              </a>
            </p>
          </div>
          <div>
            <p className="font-medium">Site</p>
            <ul className="mt-2 space-y-0.5 text-muted">
              {MARKETING_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="inline-block py-1.5 hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium">More</p>
            <ul className="mt-2 space-y-0.5 text-muted">
              <li>
                <a href={GITHUB_URL} className="inline-block py-1.5 hover:text-foreground">
                  Code on GitHub
                </a>
              </li>
              <li>
                <a href="/template.csv" className="inline-block py-1.5 hover:text-foreground">
                  CSV template
                </a>
              </li>
              <li>
                <Link href="/changelog" className="inline-block py-1.5 hover:text-foreground">
                  Changelog
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="inline-block py-1.5 hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="inline-block py-1.5 hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-foreground">
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
