"use client";
import { Cable, Loader2, Search } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { previewFromJira } from "@/app/projects/jira-actions";
import { authClient } from "@/lib/auth-client";

export type JiraSourceProps = {
  /** Whether this account has connected Jira. */
  connected: boolean;
  /** The Jira sites the connection can open, or why they couldn't be listed. */
  sites: { id: string; name: string; url: string }[];
  sitesError?: string;
  /** The project's saved site and search, from an earlier Jira import. */
  cloudId: string | null;
  jql: string | null;
  /** A starting search when the project has none. */
  suggestedJql: string;
};

/**
 * Import straight from Jira: connect once, pick a site, write the search, and
 * the issues open in the same preview as a CSV file.
 */
export function JiraSource({
  projectId,
  jira,
  onLoaded,
}: {
  projectId: string;
  jira: JiraSourceProps;
  onLoaded: (csv: string, note: string) => void;
}) {
  const id = useId();
  const [cloudId, setCloudId] = useState(jira.cloudId && jira.sites.some((s) => s.id === jira.cloudId) ? jira.cloudId : (jira.sites[0]?.id ?? ""));
  const [jql, setJql] = useState(jira.jql ?? jira.suggestedJql);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [connecting, setConnecting] = useState(false);

  if (!jira.connected) {
    return (
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Import straight from Jira</p>
          <p className="mt-1 text-sm text-muted">
            Connect your Atlassian account once. Sprintwise can then read issues from a search, sync them, and send your
            edits back.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
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
          {connecting ? "Opening Atlassian…" : "Connect Jira"}
        </button>
        {error && (
          <p role="alert" className="w-full text-sm text-not-ready">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="card space-y-4 p-5">
      <div>
        <h2 id={`${id}-title`} className="font-medium">
          From Jira
        </h2>
        <p className="mt-1 text-sm text-muted">The issues open in the preview below, where you can filter and tick them.</p>
      </div>
      {jira.sitesError ? (
        <p role="alert" className="text-sm text-not-ready">
          {jira.sitesError}
        </p>
      ) : jira.sites.length === 0 ? (
        <p className="text-sm text-muted">Your Atlassian account has no Jira site Sprintwise can read.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
            <div>
              <label htmlFor={`${id}-site`} className="label">
                Jira site
              </label>
              <select id={`${id}-site`} value={cloudId} onChange={(e) => setCloudId(e.target.value)} className="field mt-1">
                {jira.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-jql`} className="label">
                Search (JQL)
              </label>
              <input
                id={`${id}-jql`}
                value={jql}
                onChange={(e) => setJql(e.target.value)}
                className="field mt-1 font-mono text-xs"
                aria-describedby={`${id}-jql-hint`}
                spellCheck={false}
              />
              <p id={`${id}-jql-hint`} className="mt-1 text-xs text-muted">
                For one epic: <code className="font-mono">parent = ABC-45</code>. Leave out finished work with{" "}
                <code className="font-mono">statusCategory != Done</code>.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={pending || !cloudId}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await previewFromJira(projectId, cloudId, jql);
                if ("error" in result) setError(result.error);
                else
                  onLoaded(
                    result.csv,
                    `${result.count} ${result.count === 1 ? "issue" : "issues"} from Jira${result.truncated ? " (the first 1,000; narrow the search for the rest)" : ""}.`,
                  );
              })
            }
          >
            {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
            {pending ? "Reading Jira…" : "Preview issues"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-not-ready">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
