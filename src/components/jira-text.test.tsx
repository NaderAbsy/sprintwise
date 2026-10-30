import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JiraText } from "@/components/jira-text";

const render = (text: string) => renderToStaticMarkup(<JiraText text={text} />);

describe("links in text from Jira", () => {
  it("always show the host the link really goes to, so a friendly label can't hide a phishing address", () => {
    const html = render("[Reset your password|https://evil.test/login]");
    expect(html).toContain("Reset your password");
    expect(html).toContain("(evil.test)");
  });

  it("don't repeat it when the label already is that address", () => {
    const html = render("[https://example.com/a|https://example.com/b]");
    expect(html).not.toContain("(example.com)");
  });

  it("show a different host named in the label too", () => {
    expect(render("[https://bank.example/login|https://evil.test/x]")).toContain("(evil.test)");
  });

  it("leave addresses that aren't http(s) as plain text, not links", () => {
    const html = render("[click|javascript:alert(1)] [data|data:text/html,x]");
    expect(html).not.toContain("<a ");
  });
});
