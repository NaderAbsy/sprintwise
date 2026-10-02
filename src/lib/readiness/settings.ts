import { DEFAULT_MAX_POINTS, DEFAULT_VAGUE_WORDS, type RuleSettings } from "@/lib/readiness/rules";

export const SETTINGS_LIMITS = { minPoints: 1, maxPoints: 100, words: 100, wordLength: 40 };

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
