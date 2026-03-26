import type { MicroAction, OnboardingInput } from "@/lib/schemas/habit";

export const mockOnboardingData: OnboardingInput = {
  goal: "Build a writing habit",
  availableMinutes: 5,
  difficulty: "gentle",
  preferredTime: "morning",
  anchor: "after-coffee",
};

export const mockPlan: MicroAction[] = [
  {
    title: "Open your notes app and write one sentence",
    reason: "A sentence is enough to start the rhythm without pressure.",
    durationMinutes: 2,
    fallbackAction: "Open the notes app and type just three words.",
  },
  {
    title: "List one idea you might write about later",
    reason: "Collecting ideas keeps momentum alive on low-energy days.",
    durationMinutes: 3,
    fallbackAction: "Write one topic word only.",
  },
  {
    title: "Read yesterday's sentence and add one more",
    reason: "Picking up where you left off reduces friction.",
    durationMinutes: 4,
    fallbackAction: "Read yesterday's sentence and stop there.",
  },
];

export const mockWeeklySummary = {
  streakDays: 4,
  completedDays: 5,
  difficultMoments: "Evening attempts felt harder than morning ones.",
  helpfulPattern: "Linking the habit to coffee made starting easier.",
  nextAdjustment: "Keep the habit in the morning and protect the two-minute version.",
};
