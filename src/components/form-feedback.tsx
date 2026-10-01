import type { FormState } from "@/lib/form-state";

export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="mt-1 text-sm text-not-ready" aria-live="polite">
      {message}
    </p>
  );
}

export function FormAlert({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-not-ready-bg px-3 py-2 text-sm text-not-ready">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="text-sm text-ready">
        {state.message}
      </p>
    );
  }
  return null;
}
