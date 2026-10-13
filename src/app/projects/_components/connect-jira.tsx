"use client";
import { Cable } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Opens Atlassian to connect (or reconnect) Jira, then comes back to this page.
 * Reconnecting replaces an expired or revoked connection without disconnecting first.
 */
export function ConnectJiraButton({ label = "Connect Jira", className = "btn-secondary" }: { label?: string; className?: string }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={connecting}
        onClick={async () => {
          setConnecting(true);
          setError(null);
          const result = await authClient.linkSocial({ provider: "atlassian", callbackURL: window.location.pathname });
          if (result?.error) {
            setConnecting(false);
            setError(result.error.message ?? "Couldn't start the Jira connection.");
          }
        }}
      >
        <Cable aria-hidden="true" className="h-4 w-4" />
        {connecting ? "Opening Atlassian…" : label}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-not-ready">
          {error}
        </p>
      )}
    </>
  );
}
