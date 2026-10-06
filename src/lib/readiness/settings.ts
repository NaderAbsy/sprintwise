import { DEFAULT_MAX_POINTS, DEFAULT_VAGUE_WORDS, type CustomCheck, type RuleSettings } from "@/lib/readiness/rules";

export const SETTINGS_LIMITS = {
  minPoints: 1,
  maxPoints: 100,
  words: 100,
  wordLength: 40,
  checks: 10,
  checkName: 60,
  phrase: 60,
  doneStatuses: 10,
  statusLength: 50,
};

const FIELDS: CustomCheck["field"][] = ["description", "criteria", "any"];

/** Reads stored custom checks defensively: anything malformed is dropped. */
export function readCustomChecks(value: unknown): CustomCheck[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (c): c is CustomCheck =>
        typeof c === "object" &&
        c !== null &&
        typeof c.name === "string" &&
        typeof c.phrase === "string" &&
        FIELDS.includes(c.field) &&
        c.name.trim() !== "" &&
        c.phrase.trim() !== "",
    )
    .slice(0, SETTINGS_LIMITS.checks)
    .map(({ name, field, phrase }) => ({ name, field, phrase }));
}

export type CustomChecksCheck = { ok: true; checks: CustomCheck[] } | { ok: false; errors: Record<string, string> };

/** Turns the custom-checks form (parallel name / field / phrase lists) into checks. Blank rows are skipped. */
export function parseCustomChecks(names: string[], fields: string[], phrases: string[]): CustomChecksCheck {
  const errors: Record<string, string> = {};
  const checks: CustomCheck[] = [];
  names.forEach((rawName, i) => {
    const name = rawName.trim();
    const phrase = (phrases[i] ?? "").trim();
    const field = fields[i] as CustomCheck["field"];
    if (name === "" && phrase === "") return;
    if (name === "") errors[`check-${i}`] = "Give this check a name.";
    else if (phrase === "") errors[`check-${i}`] = `Say what "${name.slice(0, 30)}" must contain.`;
    else if (name.length > SETTINGS_LIMITS.checkName || phrase.length > SETTINGS_LIMITS.phrase) {
      errors[`check-${i}`] = `Keep the name and phrase under ${SETTINGS_LIMITS.phrase} characters each.`;
    } else if (!FIELDS.includes(field)) errors[`check-${i}`] = "Choose where to look.";
    else checks.push({ name, field, phrase });
  });
  if (checks.length > SETTINGS_LIMITS.checks) errors.checks = `Keep to ${SETTINGS_LIMITS.checks} checks or fewer.`;
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, checks };
}

export type SettingsCheck = { ok: true; settings: RuleSettings } | { ok: false; errors: Record<string, string> };

/**
 * Turns the settings form into rule settings (story R-6). Words are one per
 * line or comma-separated, trimmed, lower-cased and de-duplicated.
 */
export function parseRuleSettings(maxPointsText: string, vagueWordsText: string): SettingsCheck {
  const errors: Record<string, string> = {};

  const maxPoints = Number(maxPointsText.trim());
  if (!Number.isInteger(maxPoints) || maxPoints < SETTINGS_LIMITS.minPoints || maxPoints > SETTINGS_LIMITS.maxPoints) {
    errors.maxPoints = `Enter a whole number from ${SETTINGS_LIMITS.minPoints} to ${SETTINGS_LIMITS.maxPoints}.`;
  }

  const vagueWords = [
    ...new Set(
      vagueWordsText
        .split(/[\n,]/)
        .map((w) => w.trim().toLowerCase().replace(/\s+/g, " "))
        .filter((w) => w.length > 0),
    ),
  ];
  const tooLong = vagueWords.find((w) => w.length > SETTINGS_LIMITS.wordLength);
  if (tooLong) errors.vagueWords = `"${tooLong.slice(0, 20)}…" is too long; keep each word under ${SETTINGS_LIMITS.wordLength} characters.`;
  else if (vagueWords.length > SETTINGS_LIMITS.words) errors.vagueWords = `Keep the list to ${SETTINGS_LIMITS.words} words or fewer.`;

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, settings: { maxPoints, vagueWords } };
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = { maxPoints: DEFAULT_MAX_POINTS, vagueWords: DEFAULT_VAGUE_WORDS };

export function isDefault(settings: RuleSettings): boolean {
  return (
    settings.maxPoints === DEFAULT_MAX_POINTS &&
    settings.vagueWords.length === DEFAULT_VAGUE_WORDS.length &&
    settings.vagueWords.every((w, i) => w === DEFAULT_VAGUE_WORDS[i])
  );
}

export type DoneStatusesCheck = { ok: true; statuses: string[] } | { ok: false; error: string };

/** The statuses that count as Done: comma- or line-separated, trimmed, de-duplicated ignoring case, in the order typed. */
export function parseDoneStatuses(text: string): DoneStatusesCheck {
  const seen = new Set<string>();
  const statuses: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const status = raw.trim().replace(/\s+/g, " ");
    if (status === "" || seen.has(status.toLowerCase())) continue;
    seen.add(status.toLowerCase());
    statuses.push(status);
  }
  if (statuses.length === 0) return { ok: false, error: "Add at least one status, such as Done." };
  if (statuses.some((s) => s.length > SETTINGS_LIMITS.statusLength)) {
    return { ok: false, error: `Keep each status under ${SETTINGS_LIMITS.statusLength} characters.` };
  }
  if (statuses.length > SETTINGS_LIMITS.doneStatuses) {
    return { ok: false, error: `Keep to ${SETTINGS_LIMITS.doneStatuses} statuses or fewer.` };
  }
  return { ok: true, statuses };
}
