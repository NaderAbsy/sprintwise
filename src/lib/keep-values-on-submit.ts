"use client";
import { startTransition, type FormEvent } from "react";

/**
 * An onSubmit for a form whose `action` comes from useActionState. React 19 resets
 * a form after its action runs, which wipes what was typed when the server answers
 * with an error, and unticks controlled checkboxes on screen while their state stays
 * ticked. Sending the same data from onSubmit skips that reset. The form keeps its
 * `action`, so it still works as a plain form before JavaScript loads.
 */
export function keepValuesOnSubmit(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => action(data));
  };
}
