import { describe, expect, it } from "vitest";
import { secondLook } from "@/lib/readiness/second-look";

const clean = {
  title: "Refund a payment",
  description: "As a support agent I want to refund a payment so that the customer gets their money back within a day",
  acceptanceCriteria: "- Full and partial refunds can be made from the order page\n- The customer gets an email with the refunded amount",
};
const kinds = (story: Partial<typeof clean>) => secondLook({ ...clean, ...story }).map((s) => s.kind);

describe("secondLook", () => {
  it("has nothing to say about a clean, specific story", () => {
    expect(secondLook(clean)).toEqual([]);
  });

  it("spots text left over from an AI chat", () => {
    expect(kinds({ description: "Certainly! Here's a user story for refunds:\nAs a support agent…" })).toEqual(["leftover"]);
    expect(kinds({ description: `${clean.description}\n\nI hope this helps!` })).toEqual(["leftover"]);
    expect(kinds({ description: "**User story:** As a support agent I want to refund" })).toEqual(["leftover"]);
    expect(secondLook({ ...clean, description: "Here is the acceptance criteria you asked for" })[0].message).toMatch(/left over from an AI chat/);
  });

  it("spots placeholders that were never filled in", () => {
    expect(kinds({ description: "As a [insert user type] I want refunds" })).toEqual(["placeholder"]);
    expect(kinds({ acceptanceCriteria: "- Refund limit is TBD" })).toEqual(["placeholder"]);
    expect(kinds({ title: "Refund for <payment method name>" })).toEqual(["placeholder"]);
  });

  it("flags each criterion that would fit any story", () => {
    const looks = secondLook({ ...clean, acceptanceCriteria: "- Refunds show on the order page\n- All edge cases are handled\n- Unit tests are written" });
    expect(looks.map((l) => [l.kind, l.found])).toEqual([
      ["boilerplate", "All edge cases are handled"],
      ["boilerplate", "Unit tests are written"],
    ]);
    expect(looks[0].message).toContain("Definition of Done");
  });

  it("lists filler words together, and doesn't repeat the vague words the score already checks", () => {
    const looks = secondLook({ ...clean, description: "Leverage a seamless, comprehensive flow to streamline refunds" });
    expect(looks).toEqual([
      expect.objectContaining({ kind: "filler", found: "leverage, streamline, comprehensive" }),
    ]);
  });

  it("questions a precise result with no source, but not ordinary numbers", () => {
    expect(kinds({ description: "As an agent I want refunds so that we reduce support tickets by 30%" })).toEqual(["claim"]);
    expect(kinds({ acceptanceCriteria: "- The page loads within 2 seconds for 95% of requests" })).toEqual([]);
  });
});

describe("scoring (rules v4)", () => {
  const ready = { key: "A-1", storyPoints: 3, status: "To Do", ...clean };

  it("keeps a story with chat leftovers or placeholders from being Ready, but only hints at the rest", async () => {
    const { scoreStory } = await import("@/lib/readiness/rules");
    expect(scoreStory(ready).band).toBe("Ready");
    const leftover = scoreStory({ ...ready, description: `Certainly! Here's a user story:\n${clean.description}` });
    expect(leftover).toMatchObject({ score: 100, band: "Needs work" });
    expect(leftover.bandCap).toMatch(/text left over from an AI chat/);
    const placeholder = scoreStory({ ...ready, acceptanceCriteria: `${clean.acceptanceCriteria}\n- Refund limit is TBD` });
    expect(placeholder.band).toBe("Needs work");
    const filler = scoreStory({ ...ready, description: `${clean.description}, and streamline the refund flow` });
    expect(filler.band).toBe("Ready");
  });
});
