const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * The first `max` UTF-16 units of `text`, cut at a character boundary so an emoji
 * (or a letter with an accent, or a flag) is never split into "�". Never longer than `max`.
 */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = 0;
  for (const { segment } of graphemes.segment(text)) {
    if (end + segment.length > max) break;
    end += segment.length;
  }
  return text.slice(0, end);
}

/** How every "cut short" note starts, whatever follows it: a field carrying one is never sent back to Jira over the full text. */
export const CUT_MARK = "… [cut short here; ";
/** Ends a description or criteria cell from a file that was too long to keep whole. */
export const FILE_CUT = `${CUT_MARK}the full text is in your file]`;

/** `text` if it fits in `limit`, or its start followed by `note` (a "cut short" note). Never longer than `limit`. */
export function fitText(text: string, limit: number, note: string): string {
  return text.length <= limit ? text : cutText(text, limit - note.length) + note;
}
