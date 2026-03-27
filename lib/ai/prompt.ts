import type { Locale } from "@/lib/locale";
import type { HabitDecomposition, OnboardingInput } from "@/lib/validators/habit";
import type { FailureReason } from "@/types";

export type GoalArchetype = "reading" | "writing" | "study" | "exercise" | "tidy" | "digital" | "self_care" | "generic";
export type GoalIntent = "start" | "continue" | "setup" | "review" | "prepare" | "journal" | "mobility" | "surface";

export type GoalClassification = {
  archetype: GoalArchetype;
  intent: GoalIntent;
};

function normalizeClassification(classification: GoalClassification | GoalArchetype): GoalClassification {
  if (typeof classification === "string") {
    return {
      archetype: classification,
      intent: "start",
    };
  }

  return classification;
}

function buildPromptPayload(
  input: Pick<OnboardingInput, "goal" | "difficulty" | "anchor">,
  classification: GoalClassification | GoalArchetype,
  failureReason?: FailureReason,
) {
  const normalized = normalizeClassification(classification);

  return JSON.stringify({
    goal: input.goal,
    difficulty: input.difficulty,
    anchor: input.anchor,
    category: normalized.archetype,
    intent: normalized.intent,
    failureReason: failureReason ?? "none",
  });
}

export function buildAiOnlyHabitDecompositionPrompt(
  input: OnboardingInput,
  classification: GoalClassification | GoalArchetype,
  failureReason?: FailureReason,
  locale: Locale = "ko",
) {
  const durationInstruction =
    input.difficulty === "hard"
      ? "Keep main actions to 1 to 2 minutes. Make fallback actions feel like a 30 to 60 second version."
      : "Keep main actions to 1 to 5 minutes. Make fallback actions clearly smaller than the main action.";

  const failureInstruction =
    failureReason === "too_big"
      ? "The last attempt felt too big. Make the first action and fallback noticeably easier."
      : "Fallback actions must be easier than the main action while staying observable.";

  return [
    "Return JSON only.",
    "You are an execution-focused micro-habit coach.",
    locale === "ko" ? "Write short, natural Korean. No translation tone." : "Write short, natural English.",
    "Reject vague phrasing.",
    "Start every action title with an observable verb.",
    "Do not add motivation, praise, or mindset coaching.",
    durationInstruction,
    failureInstruction,
    "Choose 2 micro-actions by default. Use 3 only if clearly useful.",
    "todayAction must match microActions[0]. fallbackAction must match todayAction.fallbackAction.",
    locale === "ko" ? "Write all user-facing strings in Korean." : "Write all user-facing strings in English.",
    `DATA: ${buildPromptPayload(input, classification, failureReason)}`,
  ].join("\n");
}

export function buildHybridRewritePrompt(
  input: OnboardingInput,
  classification: GoalClassification | GoalArchetype,
  draft: Omit<HabitDecomposition, "source">,
  failureReason?: FailureReason,
  locale: Locale = "ko",
) {
  return [
    "Return JSON only.",
    "Rewrite the draft plan without changing the JSON shape or action count.",
    "Keep todayAction equal to microActions[0]. Keep fallbackAction equal to todayAction.fallbackAction.",
    locale === "ko" ? "Make Korean shorter, more natural, and less translated." : "Make the wording shorter and more natural.",
    "Keep every action concrete and observable.",
    "Make fallback actions clearly smaller than the main action.",
    "Do not add motivation, praise, or long explanations.",
    locale === "ko" ? "Write all user-facing strings in Korean." : "Write all user-facing strings in English.",
    `DATA: ${buildPromptPayload(input, classification, failureReason)}`,
    `DRAFT: ${JSON.stringify(draft)}`,
  ].join("\n");
}

export function buildHabitDecompositionPrompt(input: OnboardingInput, failureReason?: FailureReason, locale: Locale = "ko") {
  return buildAiOnlyHabitDecompositionPrompt(
    input,
    {
      archetype: "generic",
      intent: "start",
    },
    failureReason,
    locale,
  );
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
