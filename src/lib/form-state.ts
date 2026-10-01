/** What a server action returns to its form through useActionState. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

export const emptyFormState: FormState = {};
