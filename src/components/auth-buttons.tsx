"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

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
          const { error } = await authClient.signIn.social({ provider: "github", callbackURL: "/projects" });
          if (error) {
            setError(
              process.env.NODE_ENV === "development"
                ? "GitHub sign-in isn't set up: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env."
                : "GitHub sign-in isn't available right now.",
            );
            setPending(false);
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

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-muted hover:text-foreground"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
