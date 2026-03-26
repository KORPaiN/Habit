import type { MicroAction, OnboardingInput } from "@/lib/validators/habit";

export const mockOnboardingData: OnboardingInput = {
  goal: "Build a reading habit",
  availableMinutes: 5,
  difficulty: "gentle",
  preferredTime: "morning",
  anchor: "after-coffee",
};

export const mockPlan: MicroAction[] = [
  {
    title: "Open your book and read one page",
    reason: "One page is small enough to start without pressure.",
    durationMinutes: 2,
    fallbackAction: "Read one sentence only.",
  },
  {
    title: "Highlight one useful line",
    reason: "Marking one line keeps the habit visible on low-energy days.",
    durationMinutes: 3,
    fallbackAction: "Touch the book cover and stop there.",
  },
  {
    title: "Set out tomorrow's book",
    reason: "Preparing the next step reduces friction tomorrow.",
    durationMinutes: 1,
    fallbackAction: "Move the book into sight.",
  },
];

export const demoBackendIds = {
  userId: "11111111-1111-1111-1111-111111111111",
  goalId: "33333333-3333-3333-3333-333333333333",
  planId: "44444444-4444-4444-4444-444444444444",
  microActionId: "55555555-5555-5555-5555-555555555551",
  dailyActionId: "66666666-6666-6666-6666-666666666666",
} as const;

export const mockWeeklySummary = {
  streakDays: 4,
  completedDays: 5,
  difficultMoments: "Evening attempts felt harder than morning ones.",
  helpfulPattern: "Linking the habit to coffee made starting easier.",
  nextAdjustment: "Keep the habit in the morning and protect the two-minute version.",
};
