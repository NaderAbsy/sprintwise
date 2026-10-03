import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  SuggestionSchema,
  SYSTEM_PROMPT,
  userPrompt,
  withinLimits,
  type Suggestion,
} from "@/lib/ai/suggestion";
import { splitCriteria, type Story } from "@/lib/stories/types";

/**
 * The Claude API is called only from the server (requirements doc, "AI layer
 * rules"). The key lives in ANTHROPIC_API_KEY and never reaches the browser.
 */
export const DEFAULT_MODEL = "claude-opus-5-5";

/** R-4: a suggestion is shown within 15 seconds or the request gives up. */
const TIMEOUT_MS = 15_000;

/** Canned replies for end-to-end tests; never allowed in production. */
const fakeResponses = process.env.AI_FAKE_RESPONSES === "true";
if (fakeResponses && process.env.VERCEL_ENV) {
  throw new Error("AI_FAKE_RESPONSES must not be set on a Vercel deploy.");
}

export const aiConfigured = fakeResponses || Boolean(process.env.ANTHROPIC_API_KEY);

export function dailyLimit(): number {
  const parsed = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 20;
}

/** Suggestions per day across every account (AI_SITE_DAILY_LIMIT, default 200). */
export function siteDailyLimit(): number {
  const parsed = Number(process.env.AI_SITE_DAILY_LIMIT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 200;
}

export type SuggestResult = { ok: true; suggestion: Suggestion } | { ok: false; error: string };

const FAILED = "The AI suggestion isn't available right now. The rule results above still apply.";

/** Asks Claude for a rewrite and test scenarios. Never throws; failures come back as a message. */
export async function suggestForStory(
  story: Story,
  failedChecks: string[],
  client: Pick<Anthropic, "beta"> | null = defaultClient(),
): Promise<SuggestResult> {
  if (fakeResponses) return { ok: true, suggestion: fakeSuggestion(story) };
  if (!client) return { ok: false, error: "AI suggestions aren't set up on this site yet." };

  try {
    const response = await client.beta.messages.parse(
      {
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 4000,
        // If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt(story, failedChecks) }],
        output_config: { effort: "low", format: betaZodOutputFormat(SuggestionSchema) },
      },
      { timeout: TIMEOUT_MS, maxRetries: 1 },
    );

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The AI declined to rewrite this story. The rule results above still apply." };
    }
    const suggestion = response.parsed_output;
    if (response.stop_reason === "max_tokens" || !suggestion || !withinLimits(suggestion)) {
      return { ok: false, error: FAILED };
    }
    return { ok: true, suggestion };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "The AI service is busy. Try again in a minute." };
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, error: "The AI took too long to answer. Try again." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Claude API authentication failed; check ANTHROPIC_API_KEY.");
      return { ok: false, error: FAILED };
    }
    // Log the status only, never the story text (requirements doc, "Reliability").
    console.error("Claude API request failed:", error instanceof Anthropic.APIError ? error.status : "no response");
    return { ok: false, error: FAILED };
  }
}

function defaultClient(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

/** A deterministic reply built from the story itself, for tests. */
function fakeSuggestion(story: Story): Suggestion {
  const criteria = splitCriteria(story.acceptanceCriteria);
  const rewritten = criteria.length > 0 ? criteria : ["The result is shown within 2 seconds of the request"];
  return {
    rewrite: {
      title: story.title,
      description: `As a customer, I want ${story.title.toLowerCase()}, so that I can finish my task without help.`,
      acceptance_criteria: rewritten,
    },
    scenarios: rewritten.map((criterion) => ({
      criterion,
      given: "a signed-in customer",
      when: "they use the feature",
      then: criterion.charAt(0).toLowerCase() + criterion.slice(1),
    })),
  };
}
