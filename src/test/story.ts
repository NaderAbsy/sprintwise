import type { Story } from "@/lib/stories/types";

/** A story with every field filled in; override only what a test is about. */
export function story(overrides: Partial<Story> = {}): Story {
  return {
    key: "TEST-1",
    title: "Export invoices as PDF",
    description: "As a finance admin I want to export an invoice as a PDF so that I can email it to a client",
    acceptanceCriteria: "- The export button appears on every invoice\n- The PDF matches the on-screen invoice",
    storyPoints: 3,
    status: "To Do",
    ...overrides,
  };
}
