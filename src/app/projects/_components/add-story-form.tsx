"use client";
import { useActionState } from "react";
import { addStory } from "@/app/projects/actions";
import { FormAlert } from "@/components/form-feedback";
import { StoryFields } from "@/components/story-fields";
import { emptyFormState } from "@/lib/form-state";

export function AddStoryForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addStory.bind(null, projectId), emptyFormState);
  return (
    <form action={action} className="card space-y-4 p-5" noValidate>
      <StoryFields errors={state.fieldErrors} showKey />
      <FormAlert state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Scoring…" : "Score and save"}
      </button>
    </form>
  );
}
