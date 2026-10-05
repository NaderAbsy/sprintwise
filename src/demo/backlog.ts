import type { Story } from "@/lib/stories/types";

/**
 * Invented sample data for demo mode. "Tidyhome" is a made-up home-cleaning
 * booking app; no story here comes from a real company or client.
 */
export const DEMO_PROJECT_NAME = "Tidyhome — booking app backlog (sample data)";

export const demoBacklog: Story[] = [
  {
    key: "TIDY-101",
    title: "Book a cleaner for a chosen time slot",
    description:
      "As a customer I want to book a cleaner for a specific 2-hour slot so that the visit fits around my work day.",
    acceptanceCriteria:
      "- Only slots with an available cleaner are shown\n- A booked slot disappears for other customers within 5 seconds\n- The customer gets a confirmation email with the date, time and address",
    storyPoints: 5,
    status: "To Do",
  },
  {
    key: "TIDY-102",
    title: "Cancel a booking",
    description: "As a customer I want to cancel a booking up to 24 hours before the visit so that I'm not charged.",
    acceptanceCriteria:
      "- The cancel button shows until 24 hours before the visit\n- Cancelling refunds the full amount to the original card\n- The cleaner is notified by push notification",
    storyPoints: 3,
    status: "To Do",
  },
  {
    key: "TIDY-103",
    title: "Fast and easy checkout",
    description: "Checkout should be quick and user-friendly.",
    acceptanceCriteria: "- Checkout is fast\n- Paying is easy",
    storyPoints: 8,
    status: "To Do",
  },
  {
    key: "TIDY-104",
    title: "Rate a cleaner after a visit",
    description: "As a customer I want to rate my cleaner from 1 to 5 stars so that other customers can choose well.",
    acceptanceCriteria: "",
    storyPoints: 2,
    status: "To Do",
  },
  {
    key: "TIDY-105",
    title: "Admin dashboard",
    description: "",
    acceptanceCriteria: "",
    storyPoints: null,
    status: "To Do",
  },
  {
    key: "TIDY-106",
    title: "Recurring weekly bookings",
    description:
      "As a regular customer I want to repeat a booking every week and I want to skip single weeks so that I don't rebook each time.",
    acceptanceCriteria:
      "- The customer can choose weekly or every two weeks\n- Skipping a week doesn't cancel the series\n- Each visit is charged 24 hours before it starts",
    storyPoints: 13,
    status: "To Do",
  },
  {
    key: "TIDY-107",
    title: "Show cleaner profile",
    description: "As a customer I want to see a cleaner's photo, rating and years of experience so that I can easily trust who is coming.",
    acceptanceCriteria: "- Profile shows photo, average rating and number of visits\n- Profile loads in an intuitive way",
    storyPoints: 3,
    status: "To Do",
  },
  {
    key: "TIDY-108",
    title: "Tip the cleaner",
    description: "As a customer I want to add a tip after the visit so that I can thank a cleaner who did great work.",
    acceptanceCriteria:
      "- Tip options are 10%, 15%, 20% or a custom amount\n- The full tip goes to the cleaner's next payout\n- No tip prompt is shown for cancelled visits",
    storyPoints: null,
    status: "To Do",
  },
  {
    key: "TIDY-109",
    title: "Cleaner sets weekly availability",
    description:
      "As a cleaner I want to set the hours I can work each week so that I only get bookings I can take.",
    acceptanceCriteria:
      "- Availability is set per day in 30-minute steps\n- Changes apply to new bookings only\n- Existing bookings outside the new hours are listed for the cleaner to review",
    storyPoints: 5,
    status: "To Do",
  },
  {
    key: "TIDY-110",
    title: "Improve the search",
    description: "Make search better and more flexible, etc.",
    acceptanceCriteria: "- Results are appropriate\n- Search works better",
    storyPoints: 5,
    status: "To Do",
  },
  {
    key: "TIDY-111",
    title: "Add special instructions to a booking",
    description: "As a customer I want to add notes such as door codes so that the cleaner can get in without calling me.",
    acceptanceCriteria: "- Notes allow up to 500 characters\n- Only the assigned cleaner can read the notes",
    storyPoints: 1,
    status: "To Do",
  },
  {
    key: "TIDY-112",
    title: "Pay with a saved card",
    description: "As a returning customer I want to pay with a saved card so that",
    acceptanceCriteria: "- The last four digits and expiry date are shown\n- The customer can remove a saved card",
    storyPoints: 3,
    status: "To Do",
  },
];
