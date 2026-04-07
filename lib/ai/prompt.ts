import type { Locale } from "@/lib/locale";
import type { BehaviorSwarmCandidate, HabitDecomposition, OnboardingBaseInput, OnboardingInput } from "@/lib/validators/habit";
import type { FailureReason } from "@/types";
import { buildStressPromptInstructions, detectAnchorCueType, isStressReliefGoal } from "@/lib/ai/anchor-patterns";

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
  const stressCueType = isStressReliefGoal(input.goal) ? detectAnchorCueType(input.anchor) : "none";

  return JSON.stringify({
    goal: input.goal,
    difficulty: input.difficulty,
    anchor: input.anchor,
    category: normalized.archetype,
    intent: normalized.intent,
    stressCueType,
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

function buildArchetypeInstructions(classification: GoalClassification | GoalArchetype) {
  const normalized = normalizeClassification(classification);

  switch (normalized.archetype) {
    case "reading":
      return [
        "For reading, prefer one line, one sentence, opening the book, or placing a bookmark.",
        "Avoid page-, chapter-, or session-sized reading tasks unless they are the clearly smallest viable step.",
      ];
    case "writing":
      return [
        "For writing, prefer one sentence, one title, one keyword, or opening the notes app.",
        "Avoid paragraph-, essay-, journal-entry-, or blog-post-sized tasks.",
      ];
    case "study":
      return [
        "For study, prefer opening the page, reading one line, or taking out the study material.",
        "Avoid full problem sets, full lessons, or broad review sessions.",
      ];
    case "exercise":
      return [
        "For exercise, prefer one minute, one setup action, one stretch, or putting on shoes.",
        "Avoid full workouts or anything that feels like a full session.",
      ];
    case "tidy":
      return [
        "For tidying, prefer one item, one visible spot, or one setup action.",
        "Avoid room-sized or category-sized cleaning tasks.",
      ];
    case "digital":
      return [
        "For digital habits, prefer closing one app, turning off one notification, or opening one settings screen.",
        "Avoid broad detox, cleanup, or reset tasks.",
      ];
    case "self_care":
      return [
        "For self-care, prefer one glass of water, one breath, or one preparation action.",
        "Avoid routines that require a full session or strong motivation.",
      ];
    default:
      return [
        "Prefer the smallest visible entry step: open, place, take out, look at, or write one thing.",
        "Avoid anything that sounds like a full session, milestone, or transformation task.",
      ];
  }
}

function buildStressSpecificInstructions(input: Pick<OnboardingInput, "goal" | "anchor">, locale: Locale) {
  if (!isStressReliefGoal(input.goal)) {
    return [];
  }

  return buildStressPromptInstructions(input.anchor, locale);
}

function buildAnchorContextInstructions(anchor: string, locale: Locale) {
  const cueType = detectAnchorCueType(anchor);

  if (locale !== "ko") {
    switch (cueType) {
      case "morning":
      case "shower":
      case "coffee":
        return ["This cue happens at the start of a routine, so prefer actions that begin instantly with almost no setup."];
      case "midday":
      case "appointment":
      case "commute":
      case "outside":
        return ["This cue happens away from a long work block, so prefer portable actions that do not require a desk or full setup."];
      case "evening":
      case "bedtime":
        return ["This cue happens when energy is lower, so prefer quieter and lower-stimulation actions."];
      default:
        return ["Make the action fit the body position and environment implied by the anchor cue."];
    }
  }

  switch (cueType) {
    case "morning":
    case "shower":
    case "coffee":
      return ["이 루틴은 시작 지점이 분명하므로, 바로 붙일 수 있는 무설정 행동을 우선하세요."];
    case "midday":
    case "appointment":
    case "commute":
    case "outside":
      return ["이 루틴은 이동 중이거나 잠깐 비는 순간이므로, 자리나 도구를 거의 안 쓰는 행동을 우선하세요."];
    case "evening":
    case "bedtime":
      return ["이 루틴은 에너지가 내려간 시간대이므로, 조용하고 자극이 적은 행동을 우선하세요."];
    default:
      return ["루틴이 일어나는 상황과 자세에 맞는 행동을 고르세요."];
  }
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
    ...buildArchetypeInstructions(classification),
    ...buildAnchorContextInstructions(input.anchor, locale),
    ...buildStressSpecificInstructions(input, locale),
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
    ...buildArchetypeInstructions(classification),
    ...buildAnchorContextInstructions(input.anchor, locale),
    ...buildStressSpecificInstructions(input, locale),
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
    ...(isStressReliefGoal(input.goal) ? buildStressPromptInstructions(undefined, locale) : []),
    locale === "ko" ? "Write all user-facing strings in Korean." : "Write all user-facing strings in English.",
    `DATA: ${JSON.stringify({
      goal: input.goal,
      desiredOutcome: input.desiredOutcome ?? input.goal,
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
        desiredOutcome: input.goal,
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
