import Link from "next/link";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { getSession } from "@/lib/server/dal";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="no-print border-b border-border bg-surface">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={session ? "/projects" : "/"} className="text-lg font-semibold tracking-tight">
          Sprintwise
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/demo" className="text-muted hover:text-foreground">
            Demo
          </Link>
          {session ? (
            <>
              <Link href="/projects" className="text-muted hover:text-foreground">
                Projects
              </Link>
              <Link href="/account" className="text-muted hover:text-foreground">
                {session.user.name}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </nav>
    </header>
  );
}
