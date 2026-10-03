/** Writing help without AI: a story template, a scenario starter, and plain alternatives to vague words. */

export const STORY_TEMPLATE = "As a [type of user], I want [goal] so that [benefit].";
export const SCENARIO_TEMPLATE = "- Given [a starting situation], when [the user does something], then [what they see happen]";

const SUGGESTIONS: [string[], string][] = [
  [["fast", "quick", "quickly"], "Give a time: “within 2 seconds”, “in under a minute”."],
  [["easy", "easily", "simple", "intuitive", "user-friendly"], "Count it: “in 3 steps or fewer”, “without help on the first try”."],
  [["secure"], "Say who and how: “only admins can see it”, “stored encrypted”."],
  [["efficient"], "Give a limit: “uses at most 1 API call per page”."],
  [["flexible", "robust", "scalable"], "Give the case: “handles 500 bookings a day”, “works offline”."],
  [["seamless", "seamlessly"], "Say what doesn't happen: “without re-entering their card”."],
  [["appropriate", "adequate", "as needed", "and/or", "etc"], "List exactly which ones, or split them into separate criteria."],
];

/** One suggestion per vague word found, grouped so similar words share a tip. */
export function vagueWordTips(words: string[]): { words: string[]; tip: string }[] {
  const lower = words.map((w) => w.toLowerCase());
  const tips = SUGGESTIONS.map(([group, tip]) => ({ words: group.filter((g) => lower.includes(g)), tip })).filter((t) => t.words.length > 0);
  const covered = new Set(SUGGESTIONS.flatMap(([group]) => group));
  const custom = lower.filter((w) => !covered.has(w));
  if (custom.length > 0) tips.push({ words: custom, tip: "Replace it with something you could measure or check." });
  return tips;
}

/** Common ways to split a story that's too big to finish in one sprint. */
export const SPLIT_PATTERNS: { name: string; example: string }[] = [
  { name: "By workflow step", example: "Search for a cleaner / book a slot / pay." },
  { name: "Happy path first", example: "Successful payment now; declined cards and retries in the next story." },
  { name: "By business rule", example: "Weekday bookings first; weekend surcharges later." },
  { name: "By type of user", example: "Customers first; admins get their own story." },
  { name: "By data or platform", example: "Card payments first; PayPal later. Web first; mobile next." },
  { name: "Simple version first", example: "A plain list now; filters and sorting in a follow-up." },
];

const PLACEHOLDER = /\[(type of user|goal|benefit|a starting situation|the user does something|what they see happen)\]/i;

/** True while a template's [placeholders] are still in the text. */
export const hasPlaceholders = (text: string) => PLACEHOLDER.test(text);
