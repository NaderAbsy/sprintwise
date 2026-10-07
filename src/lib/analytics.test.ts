import { describe, expect, it } from "vitest";
import { redactUrl } from "@/lib/analytics";

const site = "https://sprintwise-omega.vercel.app";

describe("redactUrl", () => {
  it.each([
    ["/", "/"],
    ["/guide", "/guide"],
    ["/projects", "/projects"],
    ["/projects/cmuv5f8af00003g8o5n7lhc6l", "/projects/[project]"],
    ["/projects/cmuv5f8af/stories/cmuv5feu4/edit", "/projects/[project]/stories/[story]/edit"],
    ["/projects/cmuv5f8af/stories/new", "/projects/[project]/stories/new"],
    ["/projects/cmuv5f8af/sprints/cmuv5fsht/report", "/projects/[project]/sprints/[sprint]/report"],
    ["/share/" + "a".repeat(43), "/share/[token]"],
    ["/share/backlog/" + "b".repeat(43), "/share/backlog/[token]"],
  ])("%s → %s", (path, expected) => {
    expect(redactUrl(site + path)).toBe(site + expected);
  });

  it("drops search terms, filters and anchors", () => {
    expect(redactUrl(`${site}/projects/abc?q=refund%20for%20Acme&status=Done#rules`)).toBe(`${site}/projects/[project]`);
  });

  it("doesn't count API calls or anything that isn't a URL", () => {
    expect(redactUrl(`${site}/api/auth/session`)).toBeNull();
    expect(redactUrl("not a url")).toBeNull();
  });
});
