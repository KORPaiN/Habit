import type { Locale } from "@/lib/locale";
import type { BehaviorSwarmCandidate, HabitDecomposition, OnboardingBaseInput, OnboardingInput } from "@/lib/validators/habit";
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

function buildHomepageToneInstructions(locale: Locale) {
  if (locale === "ko") {
    return [
      "Match this product tone: calm, brief, and concrete.",
      "The promise is: today, one small step is enough.",
      "Make actions feel smaller than the user's resistance.",
      "Prefer setup or entry actions over ambitious progress when the choice is close.",
      "Do not frame this as a weekly transformation, life reset, or motivation speech.",
    ];
  }

  return [
    "Match this product tone: calm, brief, and concrete.",
    "The promise is: today, one small step is enough.",
    "Make actions feel smaller than the user's resistance.",
    "Prefer setup or entry actions over ambitious progress when the choice is close.",
    "Do not frame this as a weekly transformation, life reset, or motivation speech.",
  ];
}

function buildDurationInstruction(input: OnboardingInput) {
  return input.difficulty === "hard"
    ? "Keep main actions to 1 to 2 minutes. Make fallback actions feel like a 30 to 60 second version."
    : "Keep main actions to 1 to 5 minutes. Make fallback actions clearly smaller than the main action.";
}

function buildFailureInstruction(failureReason?: FailureReason) {
  return failureReason === "too_big"
    ? "The last attempt felt too big. Make the first action and fallback noticeably easier."
    : "Fallback actions must be easier than the main action while staying observable.";
}

export function buildAiOnlyHabitDecompositionPrompt(
  input: OnboardingInput,
  classification: GoalClassification | GoalArchetype,
  failureReason?: FailureReason,
  locale: Locale = "ko",
) {
  return [
    "Return JSON only.",
    "You are an execution-focused micro-habit coach.",
    ...buildHomepageToneInstructions(locale),
    locale === "ko" ? "Write short, natural Korean. No translation tone." : "Write short, natural English.",
    "Reject vague phrasing.",
    "Start every action title with an observable verb.",
    "Keep goalSummary and each reason to one short sentence.",
    "Do not add praise, guilt, mindset coaching, or emotional framing.",
    "Prefer actions like open, place, read one line, write one sentence, close one app, or take out what you need.",
    buildDurationInstruction(input),
    buildFailureInstruction(failureReason),
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
    ...buildHomepageToneInstructions(locale),
    locale === "ko" ? "Make Korean shorter, more natural, and less translated." : "Make the wording shorter and more natural.",
    "Keep every action concrete and observable.",
    "Shorten goalSummary and each reason.",
    "If two options feel similar, prefer the easier entry step.",
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

export function buildBehaviorSwarmPrompt(input: OnboardingBaseInput, locale: Locale = "ko") {
  return [
    "Return JSON only.",
    "You are an execution-focused micro-habit coach.",
    ...buildHomepageToneInstructions(locale),
    locale === "ko" ? "Write short, natural Korean. No translation tone." : "Write short, natural English.",
    "Generate 6 to 10 tiny behavior candidates.",
    "Every candidate must be concrete, observable, and easy to start now.",
    "Prefer low-resistance entry behaviors over larger outcome behaviors.",
    "Keep each candidate to 1 to 5 minutes.",
    "Do not use vague phrases like do your best, keep going, or work on it.",
    "Each candidate needs desireScore, abilityScore, and impactScore from 1 to 5.",
    locale === "ko" ? "Write all user-facing strings in Korean." : "Write all user-facing strings in English.",
    `DATA: ${JSON.stringify({
      goal: input.goal,
      desiredOutcome: input.desiredOutcome,
      motivationNote: input.motivationNote ?? "",
      difficulty: input.difficulty,
      availableMinutes: input.availableMinutes,
      preferredTime: input.preferredTime,
    })}`,
  ].join("\n");
}

export function buildSelectedBehaviorPlanPrompt(
  input: Pick<OnboardingInput, "goal" | "difficulty" | "availableMinutes" | "preferredTime" | "anchor">,
  selectedBehavior: BehaviorSwarmCandidate,
  failureReason?: FailureReason,
  locale: Locale = "ko",
) {
  return [
    buildAiOnlyHabitDecompositionPrompt(
      {
        goal: input.goal,
        availableMinutes: input.availableMinutes,
        difficulty: input.difficulty,
        preferredTime: input.preferredTime,
        anchor: input.anchor,
      },
      {
        archetype: "generic",
        intent: "start",
      },
      failureReason,
      locale,
    ),
    `SELECTED_BEHAVIOR: ${JSON.stringify(selectedBehavior)}`,
    "Keep the selected behavior as today's first action or make it slightly smaller if the failure reason demands it.",
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

export const behaviorSwarmJsonSchema = {
  name: "behavior_swarm",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      candidates: {
        type: "array",
        minItems: 6,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            details: { type: "string" },
            durationMinutes: { type: "number" },
            desireScore: { type: "number" },
            abilityScore: { type: "number" },
            impactScore: { type: "number" },
          },
          required: ["title", "details", "durationMinutes", "desireScore", "abilityScore", "impactScore"],
        },
      },
    },
    required: ["candidates"],
  },
} as const;
