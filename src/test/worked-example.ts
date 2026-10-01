import type { Story } from "@/lib/stories/types";
import { story } from "@/test/story";

/**
 * The worked example from the requirements doc ("Ready, Done and testing").
 * Expected: added 5, removed 3, net +16.7%, churn 36.7%, completion 70.0%.
 */
export const baseline: Story[] = [
  story({ key: "A", storyPoints: 5, status: "To Do" }),
  story({ key: "B", storyPoints: 3, status: "To Do" }),
  story({ key: "C", storyPoints: 8, status: "To Do" }),
  story({ key: "D", storyPoints: 8, status: "To Do" }),
  story({ key: "E", storyPoints: 6, status: "To Do" }),
];

export const latest: Story[] = [
  story({ key: "A", storyPoints: 8, status: "Done" }),
  story({ key: "C", storyPoints: 8, status: "Done" }),
  story({ key: "D", storyPoints: 8, status: "Done" }),
  story({ key: "E", storyPoints: 6, status: "In progress" }),
  story({ key: "F", storyPoints: 5, status: "Done" }),
];
