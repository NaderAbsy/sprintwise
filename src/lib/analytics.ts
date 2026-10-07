/**
 * What page-view analytics may see of a URL. Search terms and filters live in
 * the query string, share links carry a secret token, and project, story and
 * sprint ids identify someone's data, so all of those are replaced or dropped.
 * Returns null for anything that isn't a page view worth counting.
 */
export function redactUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "api") return null;

  // Backlog links are /share/backlog/<token>: "backlog" stays, the token after it goes.
  const ID_AFTER: Record<string, string> = { projects: "[project]", stories: "[story]", sprints: "[sprint]", share: "[token]", backlog: "[token]" };
  const KEEP = new Set(["new", "backlog"]);
  const path = parts.map((part, i) => {
    const label = ID_AFTER[parts[i - 1]];
    return label && !KEEP.has(part) ? label : part;
  });
  return `${url.origin}/${path.join("/")}`;
}
