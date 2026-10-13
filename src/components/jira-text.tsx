import { looksLikeJira, parseInline, parseJira, type Block, type Inline } from "@/lib/stories/jira-markup";

/** The host of an http(s) address, or null when the text isn't one. */
function hostOf(text: string): string | null {
  if (!/^https?:\/\//i.test(text.trim())) return null;
  try {
    return new URL(text.trim()).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Deeper Jira bullets indent no further than this, so a run of asterisks can't push text off screen. */
const MAX_INDENT = 6;

function Spans({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, i) => {
    switch (node.t) {
      case "text":
        return <span key={i}>{node.v}</span>;
      case "b":
        return (
          <strong key={i} className="font-semibold text-foreground">
            <Spans nodes={node.c} />
          </strong>
        );
      case "i":
        return (
          <em key={i}>
            <Spans nodes={node.c} />
          </em>
        );
      case "code":
        return (
          <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">
            {node.v}
          </code>
        );
      case "link": {
        // A label that looks like an address but names another site shows where the link really goes.
        const shown = hostOf(node.text);
        const real = hostOf(node.href);
        return (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2">
            {node.text}
            {shown && real && shown !== real && <span className="text-muted no-underline"> ({real})</span>}
          </a>
        );
      }
    }
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "h":
      return (
        <p role="heading" aria-level={Math.min(6, block.level + 2)} className="font-semibold text-foreground">
          <Spans nodes={block.c} />
        </p>
      );
    case "p":
      return (
        <p>
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <Spans nodes={line} />
            </span>
          ))}
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
          {block.items.map((item, i) => (
            <li key={i} style={item.depth > 1 ? { marginLeft: `${(Math.min(item.depth, MAX_INDENT) - 1) * 1.25}rem` } : undefined}>
              <Spans nodes={item.c} />
            </li>
          ))}
        </List>
      );
    }
    case "pre":
      return <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed whitespace-pre">{block.v}</pre>;
    case "quote":
      return (
        <blockquote className="border-l-2 border-border-strong pl-3 italic">
          <Spans nodes={block.c} />
        </blockquote>
      );
    case "hr":
      return <hr className="border-border" />;
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-border">
                  {row.cells.map((cell, c) => {
                    const Cell = row.head ? "th" : "td";
                    return (
                      <Cell key={c} scope={row.head ? "col" : undefined} className={`px-2 py-1 align-top ${row.head ? "font-semibold" : ""}`}>
                        <Spans nodes={cell} />
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/**
 * Story text as Jira would show it when it uses Jira's markup (from a Jira
 * export); otherwise exactly as typed, line breaks kept.
 */
export function JiraText({ text, className = "" }: { text: string; className?: string }) {
  if (!looksLikeJira(text)) return <p className={`whitespace-pre-wrap break-words ${className}`}>{text}</p>;
  return (
    <div className={`space-y-3 break-words ${className}`}>
      {parseJira(text).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

/** One line of text (an acceptance criterion) with Jira's inline markup shown. */
export function JiraInline({ text }: { text: string }) {
  return <Spans nodes={parseInline(text)} />;
}
