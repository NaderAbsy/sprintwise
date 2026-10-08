import { describe, expect, it } from "vitest";
import { looksLikeJira, parseInline, parseJira } from "@/lib/stories/jira-markup";

describe("parseInline", () => {
  it("reads bold, italic, code and links, and leaves the rest as text", () => {
    expect(parseInline("Pay *now* or _later_ with {{card_id}} via [the docs|https://example.com/docs]")).toEqual([
      { t: "text", v: "Pay " },
      { t: "b", c: [{ t: "text", v: "now" }] },
      { t: "text", v: " or " },
      { t: "i", c: [{ t: "text", v: "later" }] },
      { t: "text", v: " with " },
      { t: "code", v: "card_id" },
      { t: "text", v: " via " },
      { t: "link", text: "the docs", href: "https://example.com/docs" },
    ]);
  });

  it("doesn't mistake maths, snake_case or unsafe links for markup", () => {
    expect(parseInline("2*3*4 and acceptance_criteria_field")).toEqual([{ t: "text", v: "2*3*4 and acceptance_criteria_field" }]);
    expect(parseInline("[click|javascript:alert(1)]")).toEqual([{ t: "text", v: "click" }]);
    expect(parseInline("{color:red}Warning{color}")).toEqual([{ t: "text", v: "Warning" }]);
  });
});

describe("parseJira", () => {
  it("splits headings, paragraphs, bullets with inline bold, and numbered lists", () => {
    const blocks = parseJira("h3. The scenario\n\nA shopper pays.\nThen gets a receipt.\n\n* *Step 1* pay\n* *Step 2* receipt\n# first\n# second");
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "list", "list"]);
    expect(blocks[0]).toEqual({ t: "h", level: 3, c: [{ t: "text", v: "The scenario" }] });
    expect(blocks[1]).toMatchObject({ t: "p", lines: [[{ t: "text", v: "A shopper pays." }], [{ t: "text", v: "Then gets a receipt." }]] });
    expect(blocks[2]).toMatchObject({ t: "list", ordered: false, items: [{ depth: 1, c: [{ t: "b" }, { t: "text", v: " pay" }] }, { depth: 1 }] });
    expect(blocks[3]).toMatchObject({ t: "list", ordered: true });
  });

  it("keeps {noformat} and {code} blocks as typed, even when they open and close mid-line", () => {
    expect(parseJira("Sent:\n{noformat}amount = 40.00\nfield  = 05{noformat}\nDone.")).toEqual([
      { t: "p", lines: [[{ t: "text", v: "Sent:" }]] },
      { t: "pre", v: "amount = 40.00\nfield  = 05" },
      { t: "p", lines: [[{ t: "text", v: "Done." }]] },
    ]);
    expect(parseJira("{code:json}\n{\"a\": 1}\n{code}")).toEqual([{ t: "pre", v: "{\"a\": 1}" }]);
    expect(parseJira("{noformat}never closed\nstill here")).toEqual([{ t: "pre", v: "never closed\nstill here" }]);
  });

  it("reads tables, quotes and rules", () => {
    expect(parseJira("||Case||Result||\n|1|Pass|\nbq. Quoted\n----")).toEqual([
      {
        t: "table",
        rows: [
          { head: true, cells: [[{ t: "text", v: "Case" }], [{ t: "text", v: "Result" }]] },
          { head: false, cells: [[{ t: "text", v: "1" }], [{ t: "text", v: "Pass" }]] },
        ],
      },
      { t: "quote", c: [{ t: "text", v: "Quoted" }] },
      { t: "hr" },
    ]);
  });
});

describe("looksLikeJira", () => {
  it("spots Jira markup but leaves plain stories alone", () => {
    expect(looksLikeJira("h3. Context\nSome text")).toBe(true);
    expect(looksLikeJira("Uses {{code}} here")).toBe(true);
    expect(looksLikeJira("A *bold* claim")).toBe(true);
    expect(looksLikeJira("As a shopper I want to pay so that I get my order")).toBe(false);
    expect(looksLikeJira("- The total is 2*3\n- It works")).toBe(false);
  });
});

describe("hostile markup", () => {
  it("reads 5,000 characters of unmatched openers quickly", () => {
    for (const text of ["{{a ".repeat(1250), "[|".repeat(2500), "*a ".repeat(1666), "[a ".repeat(1666)]) {
      const start = performance.now();
      parseJira(text);
      expect(performance.now() - start).toBeLessThan(50);
    }
  });
});
