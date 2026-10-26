import { SearchX } from "lucide-react";
import Link from "next/link";
import { SignedInOnly } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="relative grid min-h-screen place-items-center px-4">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Logo />
      </div>
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
          <SearchX aria-hidden="true" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted">Check the address for a typo. If it was a project or story, it may have been deleted.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <SignedInOnly>
            <Link href="/projects" className="btn-primary">
              Your projects
            </Link>
          </SignedInOnly>
          <Link href="/" className="btn-secondary">
            Home
          </Link>
          <Link href="/demo" className="btn-secondary">
            Try the demo
          </Link>
        </div>
      </div>
    </main>
  );
}
