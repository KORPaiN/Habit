import type { OnboardingInput } from "@/lib/schemas/habit";
import type { FailureReason } from "@/lib/types/database";

const anchorLabels: Record<OnboardingInput["anchor"], string> = {
  "after-coffee": "After coffee",
  "after-shower": "After your shower",
  "before-work": "Before work",
  "before-bed": "Before bed",
};

export function buildHabitDecompositionPrompt(input: OnboardingInput, failureReason?: FailureReason) {
  const difficultyInstruction =
    input.difficulty === "hard"
      ? "The user feels high difficulty. Make actions extra small, usually 1 to 2 minutes, and make fallback actions even lighter."
      : "Keep actions small enough to finish in 1 to 5 minutes.";

  const failureInstruction =
    failureReason === "too_big"
      ? 'The last attempt felt too big. Make fallback options noticeably smaller than the main action, often a 30 to 60 second version.'
      : "Fallback actions should be easier than the main action while still being observable.";

  return [
    "You are an execution-focused micro-habit coach.",
    "Return JSON only.",
    "Turn the user's large goal into one tiny action they can actually do today.",
    "Every action must be concrete, observable, and specific.",
    'Reject vague phrasing like "do your best", "make progress", "work on it", or "practice".',
    difficultyInstruction,
    failureInstruction,
    "Choose up to 3 micro-actions.",
    "Select one best anchor based on the user's preferred anchor and time window.",
    "todayAction must exactly match one item from microActions.",
    "fallbackAction must be the fallbackAction of todayAction.",
    "",
    `Goal: ${input.goal}`,
    `Available minutes: ${input.availableMinutes}`,
    `Difficulty: ${input.difficulty}`,
    `Preferred time: ${input.preferredTime}`,
    `Preferred anchor: ${anchorLabels[input.anchor]}`,
    failureReason ? `Failure reason: ${failureReason}` : "Failure reason: none",
  ].join("\n");
}

export const habitDecompositionJsonSchema = {
  name: "habit_decomposition",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      goalSummary: {
        type: "string",
      },
      selectedAnchor: {
        type: "string",
      },
      microActions: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            reason: { type: "string" },
            durationMinutes: { type: "number" },
            fallbackAction: { type: "string" },
          },
          required: ["title", "reason", "durationMinutes", "fallbackAction"],
        },
      },
      todayAction: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          durationMinutes: { type: "number" },
          fallbackAction: { type: "string" },
        },
        required: ["title", "reason", "durationMinutes", "fallbackAction"],
      },
      fallbackAction: {
        type: "string",
      },
    },
    required: ["goalSummary", "selectedAnchor", "microActions", "todayAction", "fallbackAction"],
  },
} as const;
