import { ogCard, OG_SIZE } from "@/lib/og-card";

export const alt = "Sprintwise: know your stories are ready before the sprint starts";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The preview for every public page, when its link is pasted into a chat or a post. */
export default function Image() {
  return ogCard({
    eyebrow: "Free for Product Owners",
    title: "Know your stories are ready before the sprint starts.",
    subtitle: "Score every story with nine fixed rules, then measure how much the sprint changed.",
    stats: [
      { label: "Fixed rules", value: "9" },
      { label: "Score", value: "0–100" },
      { label: "Sprint report", value: "1 page" },
      { label: "AI reading tickets", value: "None" },
    ],
  });
}
