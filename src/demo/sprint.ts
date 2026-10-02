import { demoBacklog } from "@/demo/backlog";
import type { Story } from "@/lib/stories/types";

/**
 * Invented sample sprint for demo mode, built from the invented Tidyhome
 * backlog. It is set up to show the product's main finding: the stories that
 * changed mid-sprint were the ones that scored low before planning.
 */

const fromBacklog = (key: string, overrides: Partial<Story> = {}): Story => {
  const story = demoBacklog.find((s) => s.key === key);
  if (!story) throw new Error(`Demo story ${key} is missing from the backlog`);
  return { ...story, ...overrides };
};

const doubleBookingBug: Story = {
  key: "TIDY-114",
  title: "Stop two customers booking the same slot",
  description:
    "As a customer I want a slot to be held while I check out so that nobody else can book it at the same time.",
  acceptanceCriteria: "- A slot is held for 5 minutes during checkout\n- A second customer sees the slot as taken",
  storyPoints: 3,
  status: "Done",
};

export const demoSprint = {
  name: "Sprint 12 (sample data)",
  startDate: new Date("2026-10-05T00:00:00Z"),
  endDate: new Date("2026-10-16T00:00:00Z"),
  snapshots: [
    {
      // Day one: the committed baseline, 32 points.
      asOfDate: new Date("2026-10-05T00:00:00Z"),
      stories: [
        fromBacklog("TIDY-101", { status: "To Do" }),
        fromBacklog("TIDY-102", { status: "To Do" }),
        fromBacklog("TIDY-103", { status: "To Do" }),
        fromBacklog("TIDY-104", { status: "To Do" }),
        fromBacklog("TIDY-107", { status: "To Do" }),
        fromBacklog("TIDY-109", { status: "To Do" }),
        fromBacklog("TIDY-110", { status: "To Do" }),
        fromBacklog("TIDY-111", { status: "To Do" }),
      ],
    },
    {
      // Day four: the vague search story is dropped and an urgent bug comes in.
      asOfDate: new Date("2026-10-08T00:00:00Z"),
      stories: [
        fromBacklog("TIDY-101", { status: "Done" }),
        fromBacklog("TIDY-102", { status: "In Progress" }),
        fromBacklog("TIDY-103", { status: "In Progress" }),
        fromBacklog("TIDY-104", { status: "To Do" }),
        fromBacklog("TIDY-107", { status: "In Progress" }),
        fromBacklog("TIDY-109", { status: "To Do" }),
        fromBacklog("TIDY-111", { status: "Done" }),
        { ...doubleBookingBug, status: "In Progress" },
      ],
    },
    {
      // Day seven: the two stories planned without clear criteria grow.
      asOfDate: new Date("2026-10-13T00:00:00Z"),
      stories: [
        fromBacklog("TIDY-101", { status: "Done" }),
        fromBacklog("TIDY-102", { status: "Done" }),
        fromBacklog("TIDY-103", {
          status: "In Progress",
          storyPoints: 13,
          acceptanceCriteria: "- Checkout has at most 3 steps\n- Saved cards are offered first",
        }),
        fromBacklog("TIDY-104", {
          status: "In Progress",
          storyPoints: 5,
          acceptanceCriteria: "- Rating is 1 to 5 stars\n- Ratings appear on the cleaner's profile within a minute",
        }),
        fromBacklog("TIDY-107", { status: "Done" }),
        fromBacklog("TIDY-109", { status: "In Progress" }),
        fromBacklog("TIDY-111", { status: "Done" }),
        doubleBookingBug,
      ],
    },
  ],
};
