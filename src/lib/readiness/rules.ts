import { splitCriteria, type Story } from "@/lib/stories/types";

/** Bump whenever a rule, weight or default changes, so old scores stay explainable. */
export const RULES_VERSION = 3;

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
  // Rules v3: words that let a story or criterion sound finished without saying what "done" looks like.
  "works",
  "properly",
  "correctly",
  "as expected",
  "better",
  "improve",
  "improved",
  "optimize",
  "optimise",
  "handle",
  "stuff",
  "things",
  "something",
  "somehow",
  "nice",
  "good",
  "various",
  "relevant",
];

/** Rules v3 (C2): roles that could be anyone, so they don't say who the story is for. */
export const GENERIC_ROLES = ["user", "users", "end user", "end-user", "person", "people", "someone", "somebody", "anyone", "everyone"];

/** Rules v3 (C1): bigger stories need more acceptance criteria. Unestimated stories need one. */
export function criteriaNeeded(points: number | null): number {
  if (points === null) return 1;
  if (points >= 13) return 3;
  if (points >= 5) return 2;
  return 1;
}

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
  /**
   * Set when this rule failed only because another one did, e.g. criteria can't
   * be testable when there are none. Its points are reported on that rule's
   * finding, so one missing thing is one reason to fix.
   */
  coveredBy?: RuleId;
};

/** One thing to fix: a failed rule plus the rules that failed because of it. */
export type Finding = { id: RuleId; check: string; reason: string; points: number };

export type Band = "Ready" | "Needs work" | "Not ready";

export type Readiness = {
  score: number;
  band: Band;
  /** Why the band is lower than the score alone would give; absent when it isn't capped. */
  bandCap?: string;
  rules: RuleResult[];
  /** What to fix, one entry per missing thing, in rule order. Their points add up to 100 − score. */
  findings: Finding[];
  /** The project's own checks, if it has any. */
  custom: CustomCheckResult[];
  rulesVersion: number;
  /** Set for bugs, tasks and other non-stories: why the story-format checks were passed without being met. */
  typeNote?: string;
};

export const RULES: ReadonlyArray<{ id: RuleId; check: string; points: number }> = [
  { id: "C1", check: "Has enough acceptance criteria", points: 20 },
  { id: "C2", check: "Follows story format for a named user", points: 15 },
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

/** Failed rules as things to fix: covered rules fold their points into the rule that covers them. */
function toFindings(rules: RuleResult[]): Finding[] {
  return rules
    .filter((r) => !r.passed && !r.coveredBy)
    .map((r) => ({
      id: r.id,
      check: r.check,
      reason: r.reason ?? "",
      points: r.points + rules.filter((c) => !c.passed && c.coveredBy === r.id).reduce((sum, c) => sum + c.points, 0),
    }));
}

/** Scores one story against the fixed rules. Pure: same story + settings → same result. */
/** Issue types scored as user stories. Anything else (a bug, a task) skips the story-format checks. */
export const USER_STORY_TYPES = ["", "story", "user story"];

export function isUserStoryType(issueType = ""): boolean {
  return USER_STORY_TYPES.includes(issueType.trim().toLowerCase());
}

export function scoreStory(story: Story, settings: RuleSettings = DEFAULT_SETTINGS): Readiness {
  const userStory = isUserStoryType(story.issueType);
  const storyText = `${story.title}\n${story.description}`;
  const criteria = splitCriteria(story.acceptanceCriteria);
  const criteriaText = criteria.join("\n");

  const hasCriteria = criteria.length > 0;
  const needed = criteriaNeeded(story.storyPoints);
  const criteriaVague = findVagueWords(criteriaText, settings.vagueWords);
  const storyVague = findVagueWords(storyText, settings.vagueWords);

  const asA = STORY_FORMAT.exec(storyText);
  const afterAsA = asA ? storyText.slice(asA.index) : "";
  const iWantAt = afterAsA.search(phrasePattern("i want"));
  const soThatAt = iWantAt >= 0 ? afterAsA.slice(iWantAt).search(phrasePattern("so that")) : -1;
  const followsFormat = asA !== null && iWantAt >= 0 && soThatAt >= 0;
  // The words between "As a" and "I want", e.g. "returning customer".
  const role =
    asA && iWantAt >= 0
      ? afterAsA.slice(asA[0].length, iWantAt).trim().replace(/[,.]+$/, "").replace(/\s+/g, " ").toLowerCase()
      : "";
  const genericRole = followsFormat && (role === "" || GENERIC_ROLES.includes(role));

  const soThat = phrasePattern("so that").exec(storyText);
  const benefit = soThat ? storyText.slice(soThat.index + soThat[0].length) : "";
  const statesBenefit = /[\p{L}\p{N}]/u.test(benefit);

  const estimated = story.storyPoints !== null;
  const smallEnough = estimated && (story.storyPoints as number) <= settings.maxPoints;

  const iWantCount = countPhrase(storyText, "i want");
  const andAlso = countPhrase(storyText, "and also") > 0;
  const singleStory = iWantCount <= 1 && !andAlso;

  const descriptionLength = story.description.trim().length;

  // A rule that fails only because another did is covered by it: one missing thing, one reason.
  const outcomes: Record<RuleId, { passed: boolean; reason: string; coveredBy?: RuleId }> = {
    C1: {
      passed: criteria.length >= needed,
      reason: !hasCriteria
        ? "No acceptance criteria, so nothing can be tested. Add at least one, one per line."
        : `A ${story.storyPoints}-point story needs at least ${needed} acceptance criteria; this has ${criteria.length}. Add one line for each thing the team must build.`,
    },
    C2: {
      passed: !userStory || (followsFormat && !genericRole),
      reason: !followsFormat
        ? soThat
          ? 'Doesn\'t follow "As a … I want … so that …" in the title or description.'
          : 'Doesn\'t follow "As a … I want … so that …", so no benefit is stated either.'
        : `"As a ${role || "…"}" could be anyone. Name who it's for, such as "As a returning customer" or "As a support agent".`,
    },
    C3: {
      passed: hasCriteria && criteriaVague.length === 0,
      reason: hasCriteria
        ? `Acceptance criteria use vague words that can't be tested: ${quoteList(criteriaVague)}.`
        : "No acceptance criteria to test, so this check can't pass.",
      coveredBy: hasCriteria ? undefined : "C1",
    },
    C4: {
      passed: !userStory || statesBenefit,
      reason: soThat
        ? 'The "so that" part is empty. Say what the user gains.'
        : 'No benefit stated. Add a "so that …" part.',
      coveredBy: soThat ? undefined : "C2",
    },
    C5: {
      passed: storyVague.length === 0,
      reason: `The story uses vague words: ${quoteList(storyVague)}. Say what you mean in measurable terms.`,
    },
    C6: {
      passed: estimated,
      reason: "Not estimated, so its size can't be checked either. Add story points.",
    },
    C7: {
      passed: smallEnough,
      reason: estimated
        ? `${story.storyPoints} points is more than the maximum of ${settings.maxPoints}. Split the story.`
        : "Not estimated, so its size can't be checked.",
      coveredBy: estimated ? undefined : "C6",
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
    const { passed, reason, coveredBy } = outcomes[id];
    if (passed) return { id, check, points, earned: points, passed };
    return coveredBy ? { id, check, points, earned: 0, passed, reason, coveredBy } : { id, check, points, earned: 0, passed, reason };
  });
  const findings = toFindings(rules);

  const custom = checkCustom(story, settings.customChecks ?? []);
  const failedCustom = custom.filter((c) => !c.passed).map((c) => c.name);

  const score = rules.reduce((sum, r) => sum + r.earned, 0);
  const cap =
    bandCapFor(rules) ??
    (failedCustom.length > 0 ? `Can't be Ready until it passes your team's checks: ${failedCustom.join(", ")}.` : undefined);
  const scoreBand = bandFor(score);
  const typeNote = userStory
    ? undefined
    : `A ${story.issueType!.trim()} doesn't need the "As a … I want … so that …" format, so those checks count as passed.`;
  if (cap && scoreBand === "Ready") {
    return { score, band: "Needs work", bandCap: cap, rules, findings, custom, rulesVersion: RULES_VERSION, ...(typeNote && { typeNote }) };
  }
  return { score, band: scoreBand, rules, findings, custom, rulesVersion: RULES_VERSION, ...(typeNote && { typeNote }) };
}

/** "7 of 12 stories ready" */
export function readySummary(results: Readiness[]): string {
  const ready = results.filter((r) => r.band === "Ready").length;
  return `${ready} of ${results.length} ${results.length === 1 ? "story" : "stories"} ready`;
}
