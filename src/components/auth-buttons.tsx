"use client";
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
