import { hasPlaceholders } from "@/lib/stories/helpers";
import { splitCriteria, type Story } from "@/lib/stories/types";

/**
 * Signs that a story was pasted from an AI chat without a careful read. They
 * don't change the score: each is a hint that can be wrong, so it asks for a
 * person's second look instead of costing points. The vague-word rule (C5)
 * already covers words like "seamless" and "robust"; these are the rest.
 */
export type SecondLook = {
  kind: "leftover" | "placeholder" | "boilerplate" | "filler" | "claim";
  /** The words that were found, quoted in the message. */
  found: string;
  message: string;
};

const LEFTOVERS: RegExp[] = [
  /\b(?:certainly|sure|absolutely|of course)[!,.]?\s+here(?:'s|’s| is| are)\b[^.\n]{0,60}/i,
  /\bhere(?:'s|’s| is| are) (?:a|an|the|your|some) [^.\n]{0,40}?(?:user stor(?:y|ies)|stor(?:y|ies)|tickets?|acceptance criteria)\b/i,
  /\bas an ai\b[^.\n]{0,30}|\blanguage model\b/i,
  /\bi hope (?:this|that) helps\b|\blet me know if\b[^.\n]{0,40}|\bfeel free to\b[^.\n]{0,30}/i,
  // Markdown that Jira shows as symbols: **bold** and ### headings.
  /\*\*[^*\n]{1,60}\*\*|^\s{0,3}#{1,6}\s+\S[^\n]{0,40}/m,
];

const PLACEHOLDERS = /\[(?:insert|add|your|placeholder|tbd|todo)\b[^\]\n]{0,40}\]|<[a-z]+(?: [a-z]+){1,4}>|\bTBD\b|\bTODO\b|\blorem ipsum\b/;

/** Criteria that would fit any story: they belong in the team's Definition of Done. */
const BOILERPLATE = [
  "works as expected",
  "functions as expected",
  "behaves as expected",
  "all edge cases",
  "edge cases are handled",
  "handled gracefully",
  "errors are handled",
  "unit tests",
  "test coverage",
  "code is reviewed",
  "code review",
  "documentation is updated",
  "is documented",
  "no regressions",
  "is responsive",
  "responsive design",
  "works on mobile and desktop",
  "meets accessibility",
  "accessibility standards",
  "performs well",
  "follows best practices",
  "best practices",
  "passes qa",
];

/** Words AI drafts lean on that say little about what changes. */
const FILLER = [
  "leverage",
  "leverages",
  "leveraging",
  "streamline",
  "streamlined",
  "enhance",
  "enhanced",
  "enhances",
  "comprehensive",
  "empower",
  "empowers",
  "cutting-edge",
  "holistic",
  "elevate",
  "delve",
  "utilize",
  "utilise",
  "facilitate",
  "synergy",
  "best-in-class",
  "world-class",
  "state-of-the-art",
  "game-changer",
  "unlock",
  "effortless",
  "effortlessly",
];

/** A promised result with a made-up-looking figure: "increase conversion by 25%". */
const CLAIM = /\b(?:increase|reduce|improve|boost|cut|grow|raise|lower|decrease)\w*\b[^.\n]{0,40}?\bby\s+\d+(?:\.\d+)?\s?%/i;

const word = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}_-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_-])`, "iu");
const quote = (s: string) => `“${s.trim().replace(/\s+/g, " ").slice(0, 60)}”`;

export function secondLook(story: Pick<Story, "title" | "description" | "acceptanceCriteria">): SecondLook[] {
  const all = `${story.title}\n${story.description}\n${story.acceptanceCriteria}`;
  const story_ = `${story.title}\n${story.description}`;
  const out: SecondLook[] = [];

  for (const pattern of LEFTOVERS) {
    const m = pattern.exec(all);
    if (m) {
      out.push({
        kind: "leftover",
        found: m[0],
        message: `${quote(m[0])} looks left over from an AI chat. Delete it, and read the rest once more.`,
      });
      break;
    }
  }

  const placeholder = PLACEHOLDERS.exec(all);
  if (placeholder) {
    out.push({ kind: "placeholder", found: placeholder[0], message: `${quote(placeholder[0])} looks like a placeholder that was never filled in.` });
  } else if (hasPlaceholders(all)) {
    out.push({ kind: "placeholder", found: "[…]", message: "A [placeholder] from a template looks like it was never filled in." });
  }

  for (const criterion of splitCriteria(story.acceptanceCriteria)) {
    const hit = BOILERPLATE.find((phrase) => word(phrase).test(criterion));
    if (hit) {
      out.push({
        kind: "boilerplate",
        found: criterion,
        message: `${quote(criterion)} would fit any story. It belongs in your team's Definition of Done; here, say what this story must do.`,
      });
    }
  }

  const filler = FILLER.filter((w) => word(w).test(story_));
  if (filler.length > 0) {
    out.push({
      kind: "filler",
      found: filler.join(", "),
      message: `${filler.map(quote).join(", ")} sound${filler.length === 1 ? "s" : ""} busy but say${filler.length === 1 ? "s" : ""} little. Say what actually changes for the user.`,
    });
  }

  const claim = CLAIM.exec(story_);
  if (claim) {
    out.push({
      kind: "claim",
      found: claim[0],
      message: `${quote(claim[0])} promises a measured result. If that figure isn't from real data, describe what the user will see instead.`,
    });
  }
  return out;
}
