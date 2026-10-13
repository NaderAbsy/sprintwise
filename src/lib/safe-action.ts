import { unstable_rethrow } from "next/navigation";
import type { FormState } from "@/lib/form-state";

/** Shown when a save doesn't reach Sprintwise or Sprintwise can't answer: the form and what was typed stay on screen. */
export const SAVE_FAILED =
  "Couldn't save: you may be offline, or signed out. What you typed is still here. Check your connection (or sign in again in a new tab), then try again.";

/**
 * Wraps a server action for useActionState so a failed request (offline, signed out,
 * a new version deployed meanwhile) shows a message in the form instead of replacing
 * the page with an error screen and losing what was typed. Redirects still happen.
 */
export function guarded<S, A extends unknown[]>(action: (state: S, ...args: A) => Promise<S>, failed: S = { error: SAVE_FAILED } as S) {
  return async (state: S, ...args: A): Promise<S> => {
    try {
      return await action(state, ...args);
    } catch (error) {
      unstable_rethrow(error);
      return failed;
    }
  };
}

/** The same for a server action called directly (a button, not a form): runs it, and returns the message on failure. */
export type Failure = { error: string; message?: undefined; fieldErrors?: undefined };

export async function attempt<T>(action: () => Promise<T>): Promise<T | Failure> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return { error: SAVE_FAILED };
  }
}

export type { FormState };
