"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Sign-in goes through Better Auth's own endpoint, which limits repeated tries.
 * A click before the page is ready isn't lost: the early-click script in the
 * root layout replays it.
 */
export function SignInButton({ className = "btn-primary" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await authClient.signIn.social({ provider: "github", callbackURL: "/projects" });
          if (result?.error) {
            setPending(false);
            setError(result.error.status === 429 ? "Too many tries. Wait a few seconds, then try again." : "GitHub sign-in isn't available right now.");
          }
        }}
      >
        {pending ? "Opening GitHub…" : "Sign in with GitHub"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-not-ready">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * "Open your projects" when signed in, otherwise the sign-in button. It asks in the browser,
 * so the public pages around it stay static and cached; until the answer arrives, it shows sign-in.
 */
export function AccountButton({ className = "btn-primary", openLabel = "Open app" }: { className?: string; openLabel?: string }) {
  const { data } = authClient.useSession();
  if (data) {
    return (
      <Link href="/projects" className={className}>
        {openLabel}
      </Link>
    );
  }
  return <SignInButton className={className} />;
}

/** The top bar's account button: on phones, signed-out visitors find sign-in in the menu instead. */
export function HeaderAccount() {
  const { data } = authClient.useSession();
  return (
    <div className={data ? "" : "hidden sm:block"}>
      <AccountButton />
    </div>
  );
}

/** Sign-in inside the phone menu, for visitors who aren't signed in. */
export function MenuAccount() {
  const { data } = authClient.useSession();
  if (data) return null;
  return (
    <div className="px-3 sm:hidden">
      <SignInButton className="btn-primary" />
    </div>
  );
}

/** Shown only to signed-in visitors (asked in the browser, so the page around it can stay static). */
export function SignedInOnly({ children }: { children: React.ReactNode }) {
  const { data } = authClient.useSession();
  return data ? children : null;
}
