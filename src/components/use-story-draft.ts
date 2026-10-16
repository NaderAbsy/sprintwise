"use client";
import { useEffect, useMemo, useState, useSyncExternalStore, type RefObject } from "react";
import type { StoryFieldName } from "@/lib/stories/compare";

type Values = Record<StoryFieldName, string>;
type Draft = { original: Values; values: Values };

const parse = (raw: string | null): Draft | null => {
  try {
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};
/** Each draft as first read on this page, until the editor closes. */
const opened = new Map<string, string | null>();
function draftAtOpen(key: string): string | null {
  if (!opened.has(key)) {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {}
    opened.set(key, raw);
  }
  return opened.get(key) ?? null;
}
const noChange = () => () => {};
const same = (a: Values, b: Values) => (Object.keys(a) as StoryFieldName[]).every((k) => (a[k] ?? "").trim() === (b[k] ?? "").trim());

/**
 * Keeps unsaved typing in this browser tab, so pressing Back (which leaves
 * without asking) or a crash doesn't lose it: opening the story again offers it
 * back. A draft is only offered while the story is still as it was when the
 * typing started; once a save lands, the story differs and the draft is dropped.
 */
export function useStoryDraft(
  key: string,
  original: Values,
  current: Values,
  dirty: boolean,
  form: RefObject<HTMLFormElement | null>,
  /** The form's last result: after a save that failed, the typing is kept again. */
  result: unknown,
) {
  // The draft as it was when the page opened: drafts saved while typing here mustn't be offered back.
  const raw = useSyncExternalStore(noChange, () => draftAtOpen(key), () => null);
  useEffect(() => () => void opened.delete(key), [key]);
  const [dismissed, setDismissed] = useState(false);
  const earlier = useMemo(() => {
    const draft = parse(raw);
    // Only for the same version of the story, and only if it says something different.
    return draft && same(draft.original, original) && !same(draft.values, original) ? draft.values : null;
  }, [raw, original]);
  const offer = dismissed ? null : earlier;

  useEffect(() => {
    if (!dirty) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ original, values: current } satisfies Draft));
    } catch {}
  }, [key, original, current, dirty, result]);

  const restore = () => {
    const el = form.current;
    if (!el || !offer) return;
    for (const [name, value] of Object.entries(offer)) {
      const field = el.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value;
    }
    // As if typed: the live score and the change marks follow.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    setDismissed(true);
  };
  const discard = () => {
    dropStoryDraft(key);
    setDismissed(true);
  };
  return { offer: offer !== null, restore, discard };
}

/** Saving or cancelling: the typing is either saved or deliberately dropped, so nothing is offered back later. */
export function dropStoryDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
