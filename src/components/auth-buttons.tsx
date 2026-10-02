"use client";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { signInWithGitHub } from "@/app/auth-actions";
import { authClient } from "@/lib/auth-client";

/** A real form, so the first click works even before hydration. */
export function SignInButton({ className = "btn-primary" }: { className?: string }) {
  const [state, action, pending] = useActionState(signInWithGitHub, null);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <button className={className} disabled={pending}>
        {pending ? "Opening GitHub…" : "Sign in with GitHub"}
      </button>
      {state?.error && (
        <span role="alert" className="text-xs text-not-ready">
          {state.error}
        </span>
      )}
    </form>
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
