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
