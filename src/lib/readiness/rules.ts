import { splitCriteria, type Story } from "@/lib/stories/types";

/** Bump whenever a rule, weight or default changes, so old scores stay explainable. */
export const RULES_VERSION = 2;

export const DEFAULT_MAX_POINTS = 8;

export const DEFAULT_VAGUE_WORDS = [
  "fast",
  "quick",
  "quickly",
  "easy",
  "easily",
  "simple",
  "user-friendly",
  "secure",
  "efficient",
  "intuitive",
  "flexible",
  "robust",
  "seamless",
  "seamlessly",
  "scalable",
  "appropriate",
  "adequate",
  "as needed",
  "and/or",
  "etc",
];

/** A team's own requirement, e.g. "Has a design link": the story must contain a phrase. */
export type CustomCheck = { name: string; field: "description" | "criteria" | "any"; phrase: string };

export type RuleSettings = {
  maxPoints: number;
  vagueWords: string[];
  /** Pass/fail only: they never change the score, but a failed one keeps the story from being Ready. */
  customChecks?: CustomCheck[];
};

export type CustomCheckResult = { name: string; passed: boolean; reason?: string };

export const DEFAULT_SETTINGS: RuleSettings = {
  maxPoints: DEFAULT_MAX_POINTS,
  vagueWords: DEFAULT_VAGUE_WORDS,
};

export type RuleId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9";

export type RuleResult = {
  id: RuleId;
  check: string;
  points: number;
  earned: number;
  passed: boolean;
  /** Plain-English reason, present only when the rule failed. */
  reason?: string;
};

export type Band = "Ready" | "Needs work" | "Not ready";

export type Readiness = {
  score: number;
  band: Band;
  /** Why the band is lower than the score alone would give; absent when it isn't capped. */
  bandCap?: string;
  rules: RuleResult[];
  /** The project's own checks, if it has any. */
  custom: CustomCheckResult[];
  rulesVersion: number;
};

export const RULES: ReadonlyArray<{ id: RuleId; check: string; points: number }> = [
  { id: "C1", check: "Has acceptance criteria", points: 20 },
  { id: "C2", check: "Follows story format", points: 15 },
  { id: "C3", check: "Acceptance criteria are testable", points: 15 },
  { id: "C4", check: "States a benefit", points: 10 },
  { id: "C5", check: "No vague words in the story", points: 10 },
  { id: "C6", check: "Is estimated", points: 10 },
  { id: "C7", check: "Small enough", points: 10 },
  { id: "C8", check: "One story, not two", points: 5 },
  { id: "C9", check: "Has a description", points: 5 },
];

/**
 * Blockers (rules v2): a story that isn't estimated (C6) or is too big (C7)
 * can't be Ready, whatever its score, because the team can't commit to it.
 * The score itself is unchanged, so every point lost still has one reason.
 */
const BLOCKERS: ReadonlyArray<{ id: RuleId; cap: string }> = [
  { id: "C6", cap: "Can't be Ready until it's estimated." },
  { id: "C7", cap: "Can't be Ready until it's split below the maximum size." },
];

function bandCapFor(rules: RuleResult[]): string | undefined {
  return BLOCKERS.find((b) => rules.some((r) => r.id === b.id && !r.passed))?.cap;
}

export function bandFor(score: number): Band {
  if (score >= 80) return "Ready";
  if (score >= 50) return "Needs work";
  return "Not ready";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive: "fast" matches "Fast" but not "breakfast". */
function phrasePattern(phrase: string, flags = "i"): RegExp {
  const body = escapeRegExp(phrase.trim()).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${body}(?![\\p{L}\\p{N}_-])`, `${flags}u`);
}

/** The distinct vague words found in `text`, in list order. */
export function findVagueWords(text: string, vagueWords: string[]): string[] {
  return vagueWords.filter((word) => word.trim() !== "" && phrasePattern(word).test(text));
}

function countPhrase(text: string, phrase: string): number {
  return text.match(phrasePattern(phrase, "gi"))?.length ?? 0;
}

const STORY_FORMAT = new RegExp(
  `${phrasePattern("as a").source}|${phrasePattern("as an").source}`,
  "iu",
);

function quoteList(words: string[]): string {
  return words.map((w) => `"${w}"`).join(", ");
}

const FIELD_LABEL: Record<CustomCheck["field"], string> = {
  description: "the title or description",
  criteria: "the acceptance criteria",
  any: "the story",
};

/** Case-insensitive "contains". A plain substring, so a link like "figma.com" works. */
function checkCustom(story: Story, checks: CustomCheck[]): CustomCheckResult[] {
  return checks.map((check) => {
    const text =
      check.field === "description"
        ? `${story.title}\n${story.description}`
        : check.field === "criteria"
          ? story.acceptanceCriteria
          : `${story.title}\n${story.description}\n${story.acceptanceCriteria}`;
    const passed = text.toLowerCase().includes(check.phrase.toLowerCase());
    return passed
      ? { name: check.name, passed }
      : { name: check.name, passed, reason: `Add "${check.phrase}" to ${FIELD_LABEL[check.field]}.` };
  });
}

/** Scores one story against the fixed rules. Pure: same story + settings → same result. */
export function scoreStory(story: Story, settings: RuleSettings = DEFAULT_SETTINGS): Readiness {
  const storyText = `${story.title}\n${story.description}`;
  const criteria = splitCriteria(story.acceptanceCriteria);
  const criteriaText = criteria.join("\n");

  const hasCriteria = criteria.length > 0;
  const criteriaVague = findVagueWords(criteriaText, settings.vagueWords);
  const storyVague = findVagueWords(storyText, settings.vagueWords);

  const asA = STORY_FORMAT.exec(storyText);
  const afterAsA = asA ? storyText.slice(asA.index) : "";
  const iWantAt = afterAsA.search(phrasePattern("i want"));
  const soThatAt = iWantAt >= 0 ? afterAsA.slice(iWantAt).search(phrasePattern("so that")) : -1;
  const followsFormat = asA !== null && iWantAt >= 0 && soThatAt >= 0;

  const soThat = phrasePattern("so that").exec(storyText);
  const benefit = soThat ? storyText.slice(soThat.index + soThat[0].length) : "";
  const statesBenefit = /[\p{L}\p{N}]/u.test(benefit);

  const estimated = story.storyPoints !== null;
  const smallEnough = estimated && (story.storyPoints as number) <= settings.maxPoints;

  const iWantCount = countPhrase(storyText, "i want");
  const andAlso = countPhrase(storyText, "and also") > 0;
  const singleStory = iWantCount <= 1 && !andAlso;

  const descriptionLength = story.description.trim().length;

  const outcomes: Record<RuleId, { passed: boolean; reason: string }> = {
    C1: {
      passed: hasCriteria,
      reason: "No acceptance criteria. Add at least one, one per line.",
    },
    C2: {
      passed: followsFormat,
      reason: 'Doesn\'t follow "As a … I want … so that …" in the title or description.',
    },
    C3: {
      passed: hasCriteria && criteriaVague.length === 0,
      reason: hasCriteria
        ? `Acceptance criteria use vague words that can't be tested: ${quoteList(criteriaVague)}.`
        : "No acceptance criteria to test, so this check can't pass.",
    },
    C4: {
      passed: statesBenefit,
      reason: soThat
        ? 'The "so that" part is empty. Say what the user gains.'
        : 'No benefit stated. Add a "so that …" part.',
    },
    C5: {
      passed: storyVague.length === 0,
      reason: `The story uses vague words: ${quoteList(storyVague)}. Say what you mean in measurable terms.`,
    },
    C6: {
      passed: estimated,
      reason: "Not estimated. Add story points.",
    },
    C7: {
      passed: smallEnough,
      reason: estimated
        ? `${story.storyPoints} points is more than the maximum of ${settings.maxPoints}. Split the story.`
        : "Not estimated, so its size can't be checked.",
    },
    C8: {
      passed: singleStory,
      reason: andAlso
        ? 'Uses "and also", which usually joins two features. Split it into two stories.'
        : `Has ${iWantCount} "I want" parts. Split it into one story per want.`,
    },
    C9: {
      passed: descriptionLength >= 20,
      reason:
        descriptionLength === 0
          ? "No description."
          : `The description is only ${descriptionLength} characters; at least 20 are needed.`,
    },
  };

  const rules: RuleResult[] = RULES.map(({ id, check, points }) => {
    const { passed, reason } = outcomes[id];
    return passed
      ? { id, check, points, earned: points, passed }
      : { id, check, points, earned: 0, passed, reason };
  });

  const custom = checkCustom(story, settings.customChecks ?? []);
  const failedCustom = custom.filter((c) => !c.passed).map((c) => c.name);

  const score = rules.reduce((sum, r) => sum + r.earned, 0);
  const cap =
    bandCapFor(rules) ??
    (failedCustom.length > 0 ? `Can't be Ready until it passes your team's checks: ${failedCustom.join(", ")}.` : undefined);
  const scoreBand = bandFor(score);
  if (cap && scoreBand === "Ready") {
    return { score, band: "Needs work", bandCap: cap, rules, custom, rulesVersion: RULES_VERSION };
  }
  return { score, band: scoreBand, rules, custom, rulesVersion: RULES_VERSION };
}

/** "7 of 12 stories ready" */
export function readySummary(results: Readiness[]): string {
  const ready = results.filter((r) => r.band === "Ready").length;
  return `${ready} of ${results.length} ${results.length === 1 ? "story" : "stories"} ready`;
}
