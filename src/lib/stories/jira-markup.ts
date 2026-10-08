/**
 * A reader for the Jira wiki markup that Jira's CSV export writes into text
 * fields (h3. headings, *bold*, {{code}}, {noformat} blocks, * bullets, tables).
 * It only builds a tree for display: nothing is turned into HTML here, links
 * are kept only when they're http(s), and anything it doesn't know stays text.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; text: string; href: string };

export type Block =
  | { t: "h"; level: number; c: Inline[] }
  | { t: "p"; lines: Inline[][] }
  | { t: "list"; ordered: boolean; items: { depth: number; c: Inline[] }[] }
  | { t: "pre"; v: string }
  | { t: "quote"; c: Inline[] }
  | { t: "hr" }
  | { t: "table"; rows: { head: boolean; cells: Inline[][] }[] };

/** Whether the text uses Jira markup at all; plain text is shown as typed. */
export function looksLikeJira(text: string): boolean {
  return /^h[1-6]\.\s|\{noformat|\{code|\{\{|^\|\||^bq\.\s|\{color/m.test(text) || /(^|\s)\*\S[^*\n]*\*(\s|$|[.,:;])/m.test(text);
}

const SAFE_URL = /^https?:\/\/[^\s]+$/i;

/** Bold, italic, {{code}}, [links] and stray {color} tags in one line of text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  // Every repeated part has an upper bound, so text full of unmatched "{{" or "[|" can't make each
  // opener rescan the rest of a long line (that made the shared backlog slow on hostile text).
  const pattern =
    /\{\{(.{1,500}?)\}\}|\{color(?::[^}]{0,50})?\}|\[([^[\]|\n]{0,300})\|([^[\]|\s]{1,2000})\]|\[(https?:\/\/[^[\]\s]{1,2000})\]|(^|[\s(\[>"'])\*(?=\S)([^*\n]{0,500}?\S)\*(?=$|[\s).,:;!?\]'"<-])|(^|[\s(\[>"'])_(?=\S)([^_\n]{0,500}?\S)_(?=$|[\s).,:;!?\]'"<-])/g;
  let last = 0;
  const pushText = (v: string) => {
    if (!v) return;
    const prev = out.at(-1);
    if (prev?.t === "text") prev.v += v;
    else out.push({ t: "text", v });
  };
  for (const m of text.matchAll(pattern)) {
    const start = m.index;
    pushText(text.slice(last, start));
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[0].startsWith("{color")) {
      // Colour tags are dropped; the text between them stays.
    } else if (m[3] !== undefined) {
      const label = m[2] || m[3];
      if (SAFE_URL.test(m[3])) out.push({ t: "link", text: label, href: m[3] });
      else pushText(label);
    } else if (m[4] !== undefined) out.push({ t: "link", text: m[4], href: m[4] });
    else if (m[6] !== undefined) {
      pushText(m[5]);
      out.push({ t: "b", c: parseInline(m[6]) });
    } else if (m[8] !== undefined) {
      pushText(m[7]);
      out.push({ t: "i", c: parseInline(m[8]) });
    }
    last = start + m[0].length;
  }
  pushText(text.slice(last));
  return out;
}

/** Splits Jira markup into blocks: headings, paragraphs, lists, preformatted text, quotes, rules and tables. */
export function parseJira(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: Inline[][] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ t: "p", lines: para });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // {noformat} or {code}: everything up to the closing tag, on this line or later ones.
    const open = /^\{(noformat|code)(?::[^}]*)?\}/.exec(trimmed);
    if (open) {
      flush();
      const close = `{${open[1]}}`;
      let rest = trimmed.slice(open[0].length);
      const body: string[] = [];
      let end = rest.indexOf(close);
      while (end < 0 && i + 1 < lines.length) {
        body.push(rest);
        rest = lines[++i];
        end = rest.indexOf(close);
      }
      body.push(end < 0 ? rest : rest.slice(0, end));
      blocks.push({ t: "pre", v: body.join("\n").replace(/^\n+|\n+$/g, "") });
      const after = end < 0 ? "" : rest.slice(end + close.length).trim();
      if (after) para.push(parseInline(after));
      continue;
    }

    if (trimmed === "") {
      flush();
      continue;
    }
    const heading = /^h([1-6])\.\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ t: "h", level: Number(heading[1]), c: parseInline(heading[2]) });
      continue;
    }
    if (/^-{4,}$/.test(trimmed)) {
      flush();
      blocks.push({ t: "hr" });
      continue;
    }
    const quote = /^bq\.\s+(.*)$/.exec(trimmed);
    if (quote) {
      flush();
      blocks.push({ t: "quote", c: parseInline(quote[1]) });
      continue;
    }
    const bullet = /^([*#-]+)\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flush();
      const ordered = bullet[1].endsWith("#");
      const item = { depth: bullet[1].length, c: parseInline(bullet[2]) };
      const prev = blocks.at(-1);
      if (prev?.t === "list" && prev.ordered === ordered) prev.items.push(item);
      else blocks.push({ t: "list", ordered, items: [item] });
      continue;
    }
    if (trimmed.startsWith("|")) {
      flush();
      const head = trimmed.startsWith("||");
      const cells = trimmed
        .replace(/^\|\|?/, "")
        .replace(/\|\|?$/, "")
        .split(/\|\|?/)
        .map((cell) => parseInline(cell.trim()));
      const prev = blocks.at(-1);
      if (prev?.t === "table") prev.rows.push({ head, cells });
      else blocks.push({ t: "table", rows: [{ head, cells }] });
      continue;
    }
    para.push(parseInline(line));
  }
  flush();
  return blocks;
}
