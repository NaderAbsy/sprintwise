"use client";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

/**
 * What a page shows when something it ran into fails: a connection drop, a sign-out
 * elsewhere, or a new version deployed meanwhile. Saved work is safe, so it says so.
 */
export function ErrorPanel({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-needs-work-bg text-needs-work">
        <TriangleAlert aria-hidden="true" className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">That didn&apos;t go through</h1>
      <p className="mt-2 text-muted">
        You may be offline or signed out, or Sprintwise was updated a moment ago. Everything already saved is safe; the
        last change may need doing again.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Try again
        </button>
        <Link href="/projects" className="btn-secondary">
          Your projects
        </Link>
      </div>
    </div>
  );
}
