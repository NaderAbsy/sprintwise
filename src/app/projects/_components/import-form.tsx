"use client";
import { useActionState, useState } from "react";
import { importStories } from "@/app/projects/actions";
import { BandBadge } from "@/components/band-badge";
import { CsvFileInput } from "@/components/csv-file-input";
import { FormAlert } from "@/components/form-feedback";
import { parseStoriesCsv, type CsvResult } from "@/lib/csv/parse";
import { MAX_BYTES } from "@/lib/csv/template";
import { emptyFormState } from "@/lib/form-state";
import { readySummary, scoreStory, type RuleSettings } from "@/lib/readiness/rules";

/** Reads the file in the browser and previews it with the same parser and rules the server uses. */
export function ImportForm({ projectId, settings }: { projectId: string; settings: RuleSettings }) {
  const [state, action, pending] = useActionState(importStories.bind(null, projectId), emptyFormState);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvResult | null>(null);

  async function onFile(file: File | undefined) {
    setResult(null);
    setCsv("");
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setResult({ ok: false, errors: [{ message: "The file is larger than 1 MB." }] });
      return;
    }
    const text = await file.text();
    setCsv(text);
    setResult(parseStoriesCsv(text));
  }

  const scored = result?.ok ? result.stories.map((story) => ({ story, readiness: scoreStory(story, settings) })) : [];
  const count = (n: number) => `${n} ${n === 1 ? "story" : "stories"}`;

  return (
    <form action={action} className="space-y-5">
      <div className="card p-5">
        <label htmlFor="csv-file" className="label">
          CSV file
        </label>
        <CsvFileInput id="csv-file" onFile={onFile} />
        <input type="hidden" name="csv" value={csv} />
      </div>

      {result && !result.ok && (
        <div role="alert" className="rounded-lg bg-not-ready-bg p-4 text-sm text-not-ready">
          <p className="font-medium">This file can&apos;t be imported:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e.row ? `Row ${e.row}: ${e.message}` : e.message}</li>
            ))}
          </ul>
          {result.errors.length > 20 && <p className="mt-2">…and {result.errors.length - 20} more.</p>}
        </div>
      )}

      {result?.ok && (
        <section aria-label="Preview" className="space-y-3">
          <p className="font-medium">
            Preview: {readySummary(scored.map((s) => s.readiness))}
          </p>
          {result.warnings.length > 0 && (
            <ul className="rounded-lg bg-needs-work-bg p-3 text-sm text-needs-work">
              {result.warnings.map((w, i) => (
                <li key={i}>
                  Row {w.row}: {w.message}
                </li>
              ))}
            </ul>
          )}
          <div className="card max-h-96 overflow-auto">
            <table className="data-table">
              <thead className="sticky top-0">
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Title</th>
                  <th scope="col" className="text-right">Points</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ story, readiness }) => (
                  <tr key={story.key}>
                    <td className="whitespace-nowrap font-mono text-xs">{story.key}</td>
                    <td>{story.title}</td>
                    <td className="text-right tabular-nums">{story.storyPoints ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      <span className="mr-2 tabular-nums">{readiness.score}</span>
                      <BandBadge band={readiness.band} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" disabled={pending}>
            {pending ? "Importing…" : `Import ${count(result.stories.length)}`}
          </button>
        </section>
      )}
      <FormAlert state={state} />
    </form>
  );
}
