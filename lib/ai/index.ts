import type { Locale } from "@/lib/locale";
import { z } from "zod";
import {
  buildBehaviorSwarmPrompt,
  buildAiOnlyHabitDecompositionPrompt,
  buildHybridRewritePrompt,
  buildSelectedBehaviorPlanPrompt,
  behaviorSwarmJsonSchema,
  habitDecompositionJsonSchema,
  type GoalArchetype,
  type GoalClassification,
  type GoalIntent,
} from "@/lib/ai/prompt";
import { validateDecompositionLocale } from "@/lib/ai/locale-validation";
import { logSecurityEvent } from "@/lib/security/events";
import { API_RATE_LIMITS } from "@/lib/security/route-guard";
import { consumeRateLimits } from "@/lib/security/rate-limit";
import {
  behaviorSwarmCandidateSchema,
  behaviorSwarmSchema,
  habitDecompositionSchema,
  microActionSchema,
  onboardingBaseSchema,
  type BehaviorSwarmCandidate,
  type HabitDecomposition,
  type OnboardingBaseInput,
  type MicroAction,
  type OnboardingInput,
  type OnboardingWizardInput,
} from "@/lib/validators/habit";
import type { FailureReason } from "@/types";

type OpenAIResponsePayload = {
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output?: Array<{
    content?: Array<
      | {
          type?: string;
          text?: string | { value?: string };
        }
      | {
          type?: string;
          json?: unknown;
        }
    >;
  }>;
};

type OpenAIContentItem =
  | {
      type?: string;
      text?: string | { value?: string };
    }
  | {
      type?: string;
      json?: unknown;
    };

type OpenAIUsageMetrics = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type OpenAIRequestMode = "default" | "expanded";

type OpenAIAttempt = {
  model: string;
  modelPreference: ModelPreference;
  timeoutMs: number;
  maxOutputTokens: number;
};

type OpenAIStructuredResult<T> = {
  data: T;
  usage: OpenAIUsageMetrics;
  model: string;
};

type GenerationMetrics = {
  strategy: GenerationStrategy;
  model?: string;
  plannerMs: number;
  openaiMs: number;
  totalMs: number;
  usedFallback: boolean;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type OpenAIRequestErrorOptions = {
  status?: number;
  retryable?: boolean;
};

declare global {
  var __habitAiInflightUsers: Set<string> | undefined;
}

export type GenerationStrategy = "hybrid" | "ai_only" | "rules_only";
export type ModelPreference = "fast" | "quality" | "experimental";
export type RecentContext = {
  recentStatuses: string[];
  recentFailureReasons: string[];
  recentUsedFallbackCount: number;
  recentCompletedStreak: number;
  usedUserLevelPattern: boolean;
};
export type DraftTemplate = {
  archetype: GoalArchetype;
  intent: GoalIntent;
  microActions: MicroAction[];
  todayAction: MicroAction;
  fallbackAction: string;
};

const EMPTY_RECENT_CONTEXT: RecentContext = {
  recentStatuses: [],
  recentFailureReasons: [],
  recentUsedFallbackCount: 0,
  recentCompletedStreak: 0,
  usedUserLevelPattern: false,
};

class OpenAIRequestError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, options?: OpenAIRequestErrorOptions) {
    super(message);
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

function getInflightUsers() {
  if (!globalThis.__habitAiInflightUsers) {
    globalThis.__habitAiInflightUsers = new Set<string>();
  }

  return globalThis.__habitAiInflightUsers;
}

function isRecentContext(value: unknown): value is RecentContext {
  return typeof value === "object" && value !== null && "recentStatuses" in value;
}

function hasJsonContent(content: OpenAIContentItem): content is { type?: string; json?: unknown } {
  return typeof content === "object" && content !== null && "json" in content;
}

function hasTextContent(content: OpenAIContentItem): content is { type?: string; text?: string | { value?: string } } {
  return typeof content === "object" && content !== null && "text" in content;
}

function clampDuration(duration: number, difficulty: OnboardingInput["difficulty"]) {
  const normalized = Math.max(1, Math.min(5, Math.round(duration)));

  if (difficulty === "hard") {
    return Math.min(normalized, 2);
  }

  return normalized;
}

function maybeShrinkFallback(
  action: MicroAction,
  input: OnboardingInput,
  failureReason?: FailureReason,
  locale: Locale = "ko",
): MicroAction {
  const baseDuration = clampDuration(action.durationMinutes, input.difficulty);
  const shouldShrink = input.difficulty === "hard" || failureReason === "too_big";

  const durationMinutes = shouldShrink ? Math.min(baseDuration, 2) : baseDuration;
  const fallbackAction =
    failureReason === "too_big" && !/^touch |^open |^read one |^write one |^set out /i.test(action.fallbackAction)
      ? locale === "ko"
        ? `"${input.goal}"에 필요한 것을 열고 멈추기`
        : `Open what you need for "${input.goal}" and stop there`
      : action.fallbackAction;

  return microActionSchema.parse({
    ...action,
    durationMinutes,
    fallbackAction,
  });
}

function normalizeDecomposition(
  raw: Omit<HabitDecomposition, "source">,
  input: OnboardingInput,
  source: HabitDecomposition["source"],
  failureReason?: FailureReason,
  locale: Locale = "ko",
): HabitDecomposition {
  const microActions = raw.microActions
    .slice(0, 3)
    .map((action) => maybeShrinkFallback(action, input, failureReason, locale));

  const todayActionCandidate =
    microActions.find((action) => action.title === raw.todayAction.title) ??
    microActions.find((action) => action.fallbackAction === raw.fallbackAction) ??
    microActions[0];

  if (!todayActionCandidate) {
    throw new Error("No valid micro-actions were generated.");
  }

  const todayAction = maybeShrinkFallback(todayActionCandidate, input, failureReason, locale);
  const fallbackAction =
    failureReason === "too_big"
      ? todayAction.fallbackAction
      : microActionSchema.parse({
          ...todayAction,
          fallbackAction: todayAction.fallbackAction,
        }).fallbackAction;

  return habitDecompositionSchema.parse({
    goalSummary: raw.goalSummary,
    selectedAnchor: raw.selectedAnchor,
    microActions,
    todayAction,
    fallbackAction,
    source,
  });
}

function extractTextFromResponse(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (hasJsonContent(content) && content.json) {
        return JSON.stringify(content.json);
      }

      if (hasTextContent(content) && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }

      if (
        hasTextContent(content) &&
        typeof content.text === "object" &&
        typeof content.text?.value === "string" &&
        content.text.value.trim()
      ) {
        return content.text.value;
      }
    }
  }

  throw new OpenAIRequestError("OpenAI response did not contain structured text.");
}

function getOpenAIUsage(payload: OpenAIResponsePayload): OpenAIUsageMetrics {
  const usage = payload.usage;

  return {
    promptTokens: usage?.input_tokens,
    completionTokens: usage?.output_tokens,
    totalTokens: usage?.total_tokens,
  };
}

function readGenerationStrategy(): GenerationStrategy {
  const value = process.env.OPENAI_GENERATION_STRATEGY?.trim().toLowerCase();

  if (value === "ai_only" || value === "rules_only") {
    return value;
  }

  return "hybrid";
}

function getFastModel() {
  const configuredFast = process.env.OPENAI_MODEL_FAST?.trim();

  if (configuredFast) {
    return configuredFast;
  }

  return "gpt-5-mini";
}

function getQualityModel() {
  return process.env.OPENAI_MODEL_QUALITY?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5";
}

function getExperimentalModel() {
  return process.env.OPENAI_MODEL_EXPERIMENTAL?.trim() || undefined;
}

function pickModel(preference: ModelPreference = "fast") {
  if (preference === "quality") {
    return getQualityModel();
  }

  if (preference === "experimental") {
    return getExperimentalModel() ?? getFastModel();
  }

  return getFastModel();
}

function getOpenAITimeoutMs(mode: OpenAIRequestMode = "default") {
  const raw = Number(process.env.OPENAI_TIMEOUT_MS);
  const baseTimeout = Number.isFinite(raw) && raw > 0 ? raw : 25000;

  if (mode === "expanded") {
    return Math.max(baseTimeout + 8000, Math.ceil(baseTimeout * 1.35));
  }

  return baseTimeout;
}

function isGpt5Model(model: string) {
  return /^gpt-5(\b|-)/i.test(model.trim());
}

function getReasoningEffort(model: string, modelPreference: ModelPreference) {
  if (!isGpt5Model(model)) {
    return undefined;
  }

  if (modelPreference === "quality") {
    return "low";
  }

  return "minimal";
}

function getMaxOutputTokens(
  schema: typeof habitDecompositionJsonSchema | typeof behaviorSwarmJsonSchema,
  mode: OpenAIRequestMode = "default",
) {
  if (schema === behaviorSwarmJsonSchema) {
    return mode === "expanded" ? 1200 : 900;
  }

  return mode === "expanded" ? 1400 : 1100;
}

function buildOpenAIAttempts(
  schema: typeof habitDecompositionJsonSchema | typeof behaviorSwarmJsonSchema,
  modelPreference: ModelPreference,
) {
  const primaryModel = pickModel(modelPreference);
  const qualityModel = getQualityModel();
  const attempts: OpenAIAttempt[] = [
    {
      model: primaryModel,
      modelPreference,
      timeoutMs: getOpenAITimeoutMs("default"),
      maxOutputTokens: getMaxOutputTokens(schema, "default"),
    },
  ];

  if (modelPreference === "fast") {
    attempts.push({
      model: qualityModel,
      modelPreference: "quality",
      timeoutMs: getOpenAITimeoutMs("expanded"),
      maxOutputTokens: getMaxOutputTokens(schema, "expanded"),
    });
  } else {
    attempts.push({
      model: primaryModel,
      modelPreference,
      timeoutMs: getOpenAITimeoutMs("expanded"),
      maxOutputTokens: getMaxOutputTokens(schema, "expanded"),
    });
  }

  return attempts.filter((attempt, index, list) => {
    const firstIndex = list.findIndex(
      (candidate) =>
        candidate.model === attempt.model &&
        candidate.modelPreference === attempt.modelPreference &&
        candidate.timeoutMs === attempt.timeoutMs &&
        candidate.maxOutputTokens === attempt.maxOutputTokens,
    );

    return firstIndex === index;
  });
}

function logGenerationMetrics(metrics: GenerationMetrics) {
  console.info("[habit-ai]", JSON.stringify(metrics));
}

function getActionDurations(input: OnboardingInput) {
  const maxDuration = Math.max(1, Math.min(5, input.availableMinutes));

  return {
    primary: input.difficulty === "hard" ? 1 : Math.min(maxDuration, 2),
    secondary: input.difficulty === "hard" ? 1 : Math.min(maxDuration, 3),
  };
}

export function detectGoalArchetype(goal: string): GoalArchetype {
  const normalized = goal.toLowerCase();

  if (/clean|tidy|organize|declutter|정리|청소|치우/.test(normalized)) {
    return "tidy";
  }

  if (/read|reading|book|독서|책|읽/.test(normalized)) {
    return "reading";
  }

  if (/write|writing|journal|note|essay|글|쓰기|메모|기록/.test(normalized)) {
    return "writing";
  }

  if (/study|exam|learn|course|class|공부|시험|학습|강의/.test(normalized)) {
    return "study";
  }

  if (/exercise|workout|run|gym|stretch|운동|러닝|헬스|스트레칭/.test(normalized)) {
    return "exercise";
  }

  if (/screen|phone|app|digital|sns|social|휴대폰|핸드폰|스마트폰|디지털|앱/.test(normalized)) {
    return "digital";
  }

  if (/sleep|rest|water|meditat|care|health|수면|휴식|물 마시|건강|마음챙김/.test(normalized)) {
    return "self_care";
  }

  return "generic";
}

function detectGoalIntent(goal: string): GoalIntent {
  const normalized = goal.toLowerCase();

  if (/surface|visible|보이|꺼내|desk|책상/.test(normalized)) {
    return "surface";
  }

  if (/continue|again|resume|restart|다시|재개|복귀/.test(normalized)) {
    return "continue";
  }

  if (/setup|organize|arrange|준비|세팅|정리/.test(normalized)) {
    return "setup";
  }

  if (/review|reflect|회고|복습/.test(normalized)) {
    return "review";
  }

  if (/prepare|prep|준비/.test(normalized)) {
    return "prepare";
  }

  if (/journal|diary|일기/.test(normalized)) {
    return "journal";
  }

  if (/mobility|stretch|유연|스트레칭/.test(normalized)) {
    return "mobility";
  }

  return "start";
}

function getGoalClassification(goal: string): GoalClassification {
  return {
    archetype: detectGoalArchetype(goal),
    intent: detectGoalIntent(goal),
  };
}

export function classifyGoal(goal: string) {
  return getGoalClassification(goal);
}

function buildGoalSummary(goal: string, locale: Locale) {
  return locale === "ko"
    ? `오늘은 "${goal}" 한 단계만 합니다.`
    : `Today, we turn "${goal}" into one doable step.`;
}

function buildRuleActions(
  archetype: GoalArchetype,
  input: OnboardingInput,
  failureReason?: FailureReason,
  locale: Locale = "ko",
): MicroAction[] {
  const { primary, secondary } = getActionDurations(input);
  const tooBig = failureReason === "too_big";
  const goal = input.goal;

  switch (archetype) {
    case "reading":
      return [
        {
          title: locale === "ko" ? "책을 펴고 한 줄 읽기" : "Open your book and read one line",
          reason: locale === "ko" ? "한 줄이면 바로 시작돼요." : "One line is small enough to start now.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "책만 펴기"
              : "Open the book and stop"
            : locale === "ko"
              ? "책만 펴기"
              : "Open the book and read one sentence",
        },
        {
          title: locale === "ko" ? "책갈피만 꽂아 두기" : "Place a bookmark and stop there",
          reason: locale === "ko" ? "준비만 해도 다시 오기 쉬워져요." : "Setup alone makes it easier to return.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "책을 눈에 보이게 두기" : "Leave the book where you can see it",
        },
      ];
    case "writing":
      return [
        {
          title: locale === "ko" ? "메모 앱을 열고 한 문장 쓰기" : "Open your notes app and write one sentence",
          reason: locale === "ko" ? "한 문장이면 충분해요." : "One sentence is enough for today.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "메모 앱만 열기"
              : "Open your notes app and stop"
            : locale === "ko"
              ? "메모 앱만 열기"
              : "Write three words",
        },
        {
          title: locale === "ko" ? "이어 쓸 제목 하나 적기" : "Write one title to continue later",
          reason: locale === "ko" ? "다음 시작점만 남겨 둡니다." : "Leave yourself a small restart point.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "키워드 하나 적기" : "Write one keyword",
        },
      ];
    case "study":
      return [
        {
          title: locale === "ko" ? "공부할 페이지를 펴고 한 줄 읽기" : "Open the study page and read one line",
          reason: locale === "ko" ? "첫 줄만 봐도 시작돼요." : "One line is enough to get started.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "공부할 페이지 펼치기"
              : "Open the study page and stop"
            : locale === "ko"
              ? "공부할 페이지 펼치기"
              : "Open the study page",
        },
        {
          title: locale === "ko" ? "공부 도구만 꺼내 두기" : "Take out your study tools and stop there",
          reason: locale === "ko" ? "준비만 해도 저항이 줄어요." : "Setup lowers the resistance.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "공부 도구 하나만 꺼내기" : "Take out one study tool",
        },
      ];
    case "exercise":
      return [
        {
          title: locale === "ko" ? "운동화 신고 1분 움직이기" : "Put on your shoes and move for one minute",
          reason: locale === "ko" ? "1분이면 오늘은 충분해요." : "One minute is enough for today.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "운동화 꺼내기"
              : "Take out your shoes"
            : locale === "ko"
              ? "운동화 신기"
              : "Put on your shoes",
        },
        {
          title: locale === "ko" ? "운동 매트만 펴 두기" : "Roll out the mat and stop there",
          reason: locale === "ko" ? "준비만 해도 다시 붙기 쉬워요." : "Setup makes it easier to come back.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "매트만 꺼내기" : "Take out the mat",
        },
      ];
    case "tidy":
      return [
        {
          title: locale === "ko" ? "물건 하나 제자리에 두기" : "Put one item back in its place",
          reason: locale === "ko" ? "하나면 충분해요." : "One item is enough for today.",
          durationMinutes: primary,
          fallbackAction: locale === "ko" ? "물건 하나 집어 들기" : "Pick up one item",
        },
        {
          title: locale === "ko" ? "정리할 자리 한 칸만 비우기" : "Clear one small spot",
          reason: locale === "ko" ? "보이는 자리만 가볍게 정리해요." : "Keep it visible and light.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "정리할 자리만 보기" : "Look at the spot you will clear",
        },
      ];
    case "digital":
      return [
        {
          title: locale === "ko" ? "방해되는 앱 하나 닫기" : "Close one distracting app",
          reason: locale === "ko" ? "하나만 닫아도 훨씬 가벼워져요." : "Closing one app lowers friction right away.",
          durationMinutes: primary,
          fallbackAction: locale === "ko" ? "앱 하나 보기만 하기" : "Look at one app and stop",
        },
        {
          title: locale === "ko" ? "알림 하나 끄기" : "Turn off one notification",
          reason: locale === "ko" ? "작은 방해부터 줄입니다." : "Reduce one small source of friction.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "알림 설정 열기" : "Open notification settings",
        },
      ];
    case "self_care":
      return [
        {
          title: locale === "ko" ? "물 한 컵 마시기" : "Drink one glass of water",
          reason: locale === "ko" ? "가장 쉬운 돌봄부터 갑니다." : "Start with the easiest act of care.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "컵 꺼내기"
              : "Take out a cup"
            : locale === "ko"
              ? "컵에 물 따르기"
              : "Pour water into a cup",
        },
        {
          title: locale === "ko" ? "숨 고르기 세 번 하기" : "Take three slow breaths",
          reason: locale === "ko" ? "세 번이면 부담이 적어요." : "Three breaths keep it light.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "숨 한 번 크게 쉬기" : "Take one slow breath",
        },
      ];
    case "generic":
    default:
      return [
        {
          title: locale === "ko" ? `"${goal}"에 필요한 것 하나 꺼내기` : `Take out one thing you need for "${goal}"`,
          reason: locale === "ko" ? "준비부터 하면 저항이 줄어요." : "Preparation lowers resistance.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? `"${goal}"에 필요한 것 보기`
              : `Touch one thing you need for "${goal}"`
            : locale === "ko"
              ? `"${goal}"에 필요한 것 보기`
              : `Look at one thing you need for "${goal}"`,
        },
        {
          title: locale === "ko" ? `"${goal}"의 첫 화면만 열기` : `Open the first screen for "${goal}"`,
          reason: locale === "ko" ? "열어 두기만 해도 다시 붙기 쉬워져요." : "Opening the first screen makes re-entry easier.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "첫 화면 제목만 보기" : "Look at the first screen title only",
        },
      ];
  }
}

function buildSmallerAction(archetype: GoalArchetype, input: OnboardingInput, locale: Locale): MicroAction {
  switch (archetype) {
    case "reading":
      return microActionSchema.parse({
        title: locale === "ko" ? "책을 펴고 첫 줄 보기" : "Open the book and look at the first line",
        reason: locale === "ko" ? "오늘은 첫 줄만 보면 충분해요." : "Looking at the first line is enough for today.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "책만 펴기" : "Open the book and stop",
      });
    case "writing":
      return microActionSchema.parse({
        title: locale === "ko" ? "메모 앱을 열고 커서 두기" : "Open your notes app and place the cursor",
        reason: locale === "ko" ? "열어 두기만 해도 다시 붙기 쉬워요." : "Leaving the app open makes it easier to return.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "메모 앱만 열기" : "Open your notes app and stop",
      });
    case "study":
      return microActionSchema.parse({
        title: locale === "ko" ? "공부할 페이지 펼치기" : "Open the study page and stop",
        reason: locale === "ko" ? "펼쳐 두기만 해도 충분해요." : "Opening the page is enough for now.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "교재만 꺼내기" : "Take out the study material",
      });
    case "exercise":
      return microActionSchema.parse({
        title: locale === "ko" ? "운동화만 신기" : "Put on your shoes and stop",
        reason: locale === "ko" ? "준비까지만 해도 괜찮아요." : "Stopping at setup is okay today.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "운동화 보기" : "Look at your shoes",
      });
    case "tidy":
      return microActionSchema.parse({
        title: locale === "ko" ? "물건 하나만 들기" : "Pick up one item and stop",
        reason: locale === "ko" ? "하나만 들어도 시작은 남아요." : "Picking up one item is enough for now.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "책상 보기" : "Look at your desk",
      });
    default:
      return microActionSchema.parse({
        title: locale === "ko" ? `"${input.goal}"에 필요한 것 하나 꺼내기` : `Take out one thing you need for "${input.goal}"`,
        reason: locale === "ko" ? "준비만 해도 저항이 줄어요." : "Preparation lowers the resistance.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "필요한 것 보기" : "Look at what you need and stop",
      });
  }
}

function applyRecentContext(
  input: OnboardingInput,
  classification: GoalClassification,
  actions: MicroAction[],
  recentContext: RecentContext,
  locale: Locale,
  failureReason?: FailureReason,
) {
  const normalizedFailureReason =
    failureReason ??
    (recentContext.recentFailureReasons.find((candidate): candidate is FailureReason =>
      candidate === "too_big" ||
      candidate === "too_tired" ||
      candidate === "forgot" ||
      candidate === "forgot_often" ||
      candidate === "not_wanted" ||
      candidate === "schedule_conflict" ||
      candidate === "low_motivation" ||
      candidate === "other",
    ) ??
      undefined);
  const shouldShrink =
    normalizedFailureReason === "too_big" || recentContext.recentUsedFallbackCount >= 2 || recentContext.recentStatuses.includes("failed");
  const shouldMentionAnchor = normalizedFailureReason === "forgot" || normalizedFailureReason === "forgot_often";
  const nextActions = actions.map((action, index) => {
    if (index !== 0) {
      return action;
    }

    if (!shouldShrink) {
      return action;
    }

    return buildSmallerAction(classification.archetype, input, locale);
  });

  if (!shouldMentionAnchor) {
    return nextActions;
  }

  return nextActions.map((action, index) => {
    if (index !== 0) {
      return action;
    }

    return microActionSchema.parse({
      ...action,
      reason:
        locale === "ko"
          ? `${input.anchor} 뒤에 바로 붙이면 더 쉬워요.`
          : `Do this right after ${input.anchor} so the cue is easier to notice.`,
    });
  });
}

function normalizeRuleBuildArgs(
  recentContextOrFailureReason?: RecentContext | FailureReason,
  options?: {
    locale?: Locale;
    failureReason?: FailureReason;
  },
) {
  if (typeof recentContextOrFailureReason === "string" || recentContextOrFailureReason === undefined) {
    return {
      recentContext: EMPTY_RECENT_CONTEXT,
      locale: options?.locale ?? "ko",
      failureReason: options?.failureReason ?? recentContextOrFailureReason,
    };
  }

  return {
    recentContext: recentContextOrFailureReason,
    locale: options?.locale ?? "ko",
    failureReason: options?.failureReason,
  };
}

function stripSource(decomposition: HabitDecomposition): Omit<HabitDecomposition, "source"> {
  const { source: _source, ...rest } = decomposition;
  return rest;
}

function shouldRewriteDraft(
  classification: GoalClassification,
  input: OnboardingInput,
  failureReason?: FailureReason,
) {
  const rewriteEnabled = (process.env.AI_REWRITE_ENABLED ?? "true").toLowerCase() !== "false";

  if (!rewriteEnabled) {
    return false;
  }

  if (failureReason) {
    return true;
  }

  if (classification.archetype === "generic" || classification.archetype === "digital" || classification.archetype === "self_care") {
    return true;
  }

  return input.goal.trim().length > 18;
}

export function buildRuleBasedHabitDecomposition(
  input: OnboardingInput,
  recentContextOrFailureReason?: RecentContext | FailureReason,
  options?: {
    locale?: Locale;
    failureReason?: FailureReason;
  },
): HabitDecomposition {
  const normalized = normalizeRuleBuildArgs(recentContextOrFailureReason, options);
  const classification = getGoalClassification(input.goal);
  const failureReason =
    normalized.failureReason ??
    (normalized.recentContext.recentFailureReasons.find((candidate): candidate is FailureReason =>
      candidate === "too_big" ||
      candidate === "too_tired" ||
      candidate === "forgot" ||
      candidate === "forgot_often" ||
      candidate === "not_wanted" ||
      candidate === "schedule_conflict" ||
      candidate === "low_motivation" ||
      candidate === "other",
    ) ??
      undefined);
  const baseActions = buildRuleActions(classification.archetype, input, failureReason, normalized.locale);
  const microActions = applyRecentContext(
    input,
    classification,
    baseActions,
    normalized.recentContext,
    normalized.locale,
    failureReason,
  );
  const todayAction = microActions[0];

  if (!todayAction) {
    throw new Error("규칙 기반 초안을 만들지 못했어요.");
  }

  return habitDecompositionSchema.parse({
    goalSummary: buildGoalSummary(input.goal, normalized.locale),
    selectedAnchor: input.anchor,
    microActions,
    todayAction,
    fallbackAction: todayAction.fallbackAction,
    source: "rules",
  });
}

export function buildMockHabitDecomposition(
  input: OnboardingInput,
  failureReason?: FailureReason,
  locale: Locale = "ko",
): HabitDecomposition {
  return buildRuleBasedHabitDecomposition(input, failureReason, { locale });
}

export async function collectRecentContext(_: {
  userId?: string;
  goalId?: string;
  basedOnPlanId?: string;
}): Promise<RecentContext> {
  return EMPTY_RECENT_CONTEXT;
}

export function generateDraftTemplates(
  input: OnboardingInput,
  classification: GoalClassification,
  recentContext: RecentContext,
  locale: Locale = "ko",
): DraftTemplate[] {
  const intents: GoalIntent[] = [
    classification.intent,
    "setup",
    "prepare",
    "review",
    "continue",
    "surface",
  ];

  return intents.map((intent, index) => {
    const adjustedInput =
      index === 0
        ? input
        : {
            ...input,
            goal: `${input.goal}`,
          };
    const actions = applyRecentContext(
      adjustedInput,
      {
        archetype: classification.archetype,
        intent,
      },
      buildRuleActions(classification.archetype, adjustedInput, undefined, locale),
      recentContext,
      locale,
      undefined,
    );
    const todayAction = actions[0] ?? buildSmallerAction(classification.archetype, adjustedInput, locale);

    return {
      archetype: classification.archetype,
      intent,
      microActions: actions,
      todayAction,
      fallbackAction: todayAction.fallbackAction,
    };
  });
}

function buildCandidateId(title: string, index: number) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\uD79D]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "candidate"}-${index + 1}`;
}

function scoreAbility(durationMinutes: number, difficulty: OnboardingBaseInput["difficulty"]) {
  const base = durationMinutes <= 1 ? 5 : durationMinutes <= 2 ? 4 : durationMinutes <= 3 ? 3 : 2;

  if (difficulty === "hard") {
    return Math.min(5, base + 1);
  }

  if (difficulty === "gentle") {
    return Math.max(1, base - 1);
  }

  return base;
}

function scoreDesire(title: string, durationMinutes: number) {
  let score = durationMinutes <= 2 ? 4 : 3;

  if (/열|펴|꺼내|놓|보기|닫기|신기|한 줄|한 문장|한 컵|한 칸|one line|one sentence|open|take out|close|put on/i.test(title)) {
    score += 1;
  }

  return Math.max(1, Math.min(5, score));
}

function scoreImpact(title: string, classification: GoalClassification) {
  let score = 3;

  if (classification.archetype !== "generic") {
    score += 1;
  }

  if (/첫|한 줄|한 문장|한 컵|앱 하나|물건 하나|한 칸|one line|one sentence|one glass|one item/i.test(title)) {
    score += 1;
  }

  return Math.max(1, Math.min(5, score));
}

function toBehaviorCandidate(
  action: MicroAction,
  index: number,
  input: OnboardingBaseInput,
  classification: GoalClassification,
): BehaviorSwarmCandidate {
  return behaviorSwarmCandidateSchema.parse({
    id: buildCandidateId(action.title, index),
    title: action.title,
    details: action.reason,
    durationMinutes: Math.max(1, Math.min(5, action.durationMinutes)),
    desireScore: scoreDesire(action.title, action.durationMinutes),
    abilityScore: scoreAbility(action.durationMinutes, input.difficulty),
    impactScore: scoreImpact(action.title, classification),
  });
}

function buildBehaviorSwarmFallbackInput(input: OnboardingBaseInput): OnboardingInput {
  return onboardingBaseSchema
    .extend({
      anchor: z.string().default(input.preferredTime === "evening" ? "잠들기 전" : "커피 마신 뒤"),
    })
    .parse({
      ...input,
      anchor: input.preferredTime === "evening" ? "잠들기 전" : "커피 마신 뒤",
    }) as OnboardingInput;
}

function fillBehaviorCandidates(
  candidates: BehaviorSwarmCandidate[],
  input: OnboardingBaseInput,
  classification: GoalClassification,
) {
  if (candidates.length >= 6) {
    return candidates.slice(0, 8);
  }

  const fillerActions: MicroAction[] = [
    {
      title: `"${input.goal}" 준비물 꺼내기`,
      reason: "준비만 해도 시작이 쉬워집니다.",
      durationMinutes: 1,
      fallbackAction: `"${input.goal}" 준비물 보기`,
    },
    {
      title: "첫 화면 열기",
      reason: "바로 시작하기 쉬운 준비 행동입니다.",
      durationMinutes: 1,
      fallbackAction: "첫 화면 보기",
    },
    {
      title: "한 문장만 보기",
      reason: "부담 없이 흐름을 다시 엽니다.",
      durationMinutes: 1,
      fallbackAction: "한 줄만 보기",
    },
    {
      title: "시작 자리 정하기",
      reason: "앉을 자리만 정해도 시작이 가벼워집니다.",
      durationMinutes: 1,
      fallbackAction: "자리만 보기",
    },
  ];

  const existing = new Set(candidates.map((candidate) => candidate.title.trim().toLowerCase()));
  const nextCandidates = [...candidates];

  fillerActions.forEach((action) => {
    const normalized = action.title.trim().toLowerCase();

    if (!existing.has(normalized) && nextCandidates.length < 8) {
      nextCandidates.push(toBehaviorCandidate(action, nextCandidates.length, input, classification));
      existing.add(normalized);
    }
  });

  while (nextCandidates.length < 6) {
    const index = nextCandidates.length + 1;
    const filler = toBehaviorCandidate(
      {
        title: `${input.goal} 시작 ${index}`,
        reason: "바로 할 수 있는 작은 시작입니다.",
        durationMinutes: 1,
        fallbackAction: `${input.goal} 준비만 하기`,
      },
      nextCandidates.length,
      input,
      classification,
    );

    if (existing.has(filler.title.trim().toLowerCase())) {
      break;
    }

    nextCandidates.push(filler);
    existing.add(filler.title.trim().toLowerCase());
  }

  return nextCandidates.slice(0, 8);
}

export function buildRuleBasedBehaviorSwarm(input: OnboardingBaseInput, locale: Locale = "ko"): BehaviorSwarmCandidate[] {
  const classification = getGoalClassification(input.goal);
  const fallbackInput = buildBehaviorSwarmFallbackInput(input);
  const templates = generateDraftTemplates(fallbackInput, classification, EMPTY_RECENT_CONTEXT, locale);
  const unique = new Map<string, BehaviorSwarmCandidate>();

  templates
    .flatMap((template) => template.microActions)
    .forEach((action, index) => {
      const candidate = toBehaviorCandidate(action, index, input, classification);
      const key = candidate.title.trim().toLowerCase();

      if (!unique.has(key)) {
        unique.set(key, candidate);
      }
    });

  return behaviorSwarmSchema.parse(fillBehaviorCandidates([...unique.values()], input, classification));
}

function buildSelectedBehaviorReason(input: Pick<OnboardingWizardInput, "desiredOutcome">, selectedBehavior: BehaviorSwarmCandidate, locale: Locale) {
  if (selectedBehavior.details?.trim()) {
    return selectedBehavior.details.trim();
  }

  return locale === "ko"
    ? `${input.desiredOutcome}에 가까워지기 위한 가장 가벼운 시작입니다.`
    : `This is the lightest start toward ${input.desiredOutcome}.`;
}

function deriveSelectedBehaviorFallback(
  input: Pick<OnboardingWizardInput, "goal">,
  selectedBehavior: BehaviorSwarmCandidate,
  baseAction?: MicroAction,
  locale: Locale = "ko",
) {
  if (baseAction?.fallbackAction && baseAction.title !== selectedBehavior.title) {
    return baseAction.fallbackAction;
  }

  if (locale === "ko") {
    if (/읽기|읽어/i.test(selectedBehavior.title)) return "책 펴기";
    if (/쓰기|적기/i.test(selectedBehavior.title)) return "메모 열기";
    if (/운동|스트레칭|걷기/i.test(selectedBehavior.title)) return "운동화 꺼내기";
    if (/정리|치우기/i.test(selectedBehavior.title)) return "물건 하나 집기";
    return `"${input.goal}" 준비물 꺼내기`;
  }

  return `Set out what you need for "${input.goal}"`;
}

export async function generateHabitDecompositionFromSelection(
  input: OnboardingWizardInput,
  selectedBehavior: BehaviorSwarmCandidate,
  options?: {
    failureReason?: FailureReason;
    locale?: Locale;
    strategy?: GenerationStrategy;
    modelPreference?: ModelPreference;
    userId?: string;
    goalId?: string;
    basedOnPlanId?: string;
  },
) {
  const locale = options?.locale ?? "ko";
  const base = await generateHabitDecomposition(input, options);
  const selectedAction = maybeShrinkFallback(
    {
      title: selectedBehavior.title,
      reason: buildSelectedBehaviorReason(input, selectedBehavior, locale),
      durationMinutes: selectedBehavior.durationMinutes,
      fallbackAction: deriveSelectedBehaviorFallback(input, selectedBehavior, base.todayAction, locale),
    },
    input,
    options?.failureReason,
    locale,
  );

  const remainingActions = base.microActions.filter((action) => action.title !== selectedAction.title).slice(0, 2);

  return habitDecompositionSchema.parse({
    ...base,
    microActions: [selectedAction, ...remainingActions].slice(0, 3),
    todayAction: selectedAction,
    fallbackAction: selectedAction.fallbackAction,
    selectedAnchor: input.anchor,
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenAIOnce(
  prompt: string,
  model: string,
  schema: typeof habitDecompositionJsonSchema | typeof behaviorSwarmJsonSchema = habitDecompositionJsonSchema,
  modelPreference: ModelPreference = "fast",
  requestOptions?: {
    timeoutMs?: number;
    maxOutputTokens?: number;
  },
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new OpenAIRequestError("Missing OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeoutMs = requestOptions?.timeoutMs ?? getOpenAITimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const reasoningEffort = getReasoningEffort(model, modelPreference);
  const maxOutputTokens = requestOptions?.maxOutputTokens ?? getMaxOutputTokens(schema);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: "You design tiny, calm, observable habit actions." }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        ...(reasoningEffort
          ? {
              reasoning: {
                effort: reasoningEffort,
              },
            }
          : {}),
        max_output_tokens: maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            ...schema,
          },
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OpenAIRequestError(`OpenAI request failed: ${response.status} ${errorText}`, {
        status: response.status,
        retryable: response.status >= 500 || response.status === 429,
      });
    }

    return (await response.json()) as OpenAIResponsePayload;
  } catch (error) {
    if (error instanceof OpenAIRequestError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenAIRequestError(`OpenAI request timed out after ${timeoutMs}ms`, {
        retryable: false,
      });
    }

    throw new OpenAIRequestError(error instanceof Error ? error.message : "OpenAI request failed.", {
      retryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAI(
  prompt: string,
  model: string,
  schema: typeof habitDecompositionJsonSchema | typeof behaviorSwarmJsonSchema = habitDecompositionJsonSchema,
  modelPreference: ModelPreference = "fast",
  requestOptions?: {
    timeoutMs?: number;
    maxOutputTokens?: number;
  },
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchOpenAIOnce(prompt, model, schema, modelPreference, requestOptions);
    } catch (error) {
      lastError = error;

      if (!(error instanceof OpenAIRequestError) || !error.retryable || attempt === 1) {
        throw error;
      }

      await sleep(250);
    }
  }

  throw lastError;
}

async function callOpenAIStructured<T>(
  prompt: string,
  schema: typeof habitDecompositionJsonSchema | typeof behaviorSwarmJsonSchema,
  modelPreference: ModelPreference,
  parser: (text: string) => T,
): Promise<OpenAIStructuredResult<T>> {
  const attempts = buildOpenAIAttempts(schema, modelPreference);
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const payload = await callOpenAI(prompt, attempt.model, schema, attempt.modelPreference, {
        timeoutMs: attempt.timeoutMs,
        maxOutputTokens: attempt.maxOutputTokens,
      });
      const text = extractTextFromResponse(payload);

      return {
        data: parser(text),
        usage: getOpenAIUsage(payload),
        model: attempt.model,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function buildAiUnavailableMessage(error: unknown, locale: Locale) {
  const fallback =
    locale === "ko"
      ? "지금은 AI 마이크로 플랜을 만들 수 없어요. OpenAI 설정이나 사용 한도를 확인해 주세요."
      : "We could not generate an AI micro-plan right now. Please check your OpenAI setup or quota.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (message.includes("quota")) {
    return locale === "ko"
      ? "OpenAI 사용 한도를 초과해 AI 플랜을 만들 수 없어요. 결제 또는 quota 상태를 확인해 주세요."
      : "OpenAI quota was exceeded, so we could not generate an AI plan.";
  }

  if (message.includes("missing openai_api_key")) {
    return locale === "ko"
      ? "OPENAI_API_KEY가 없어 AI 플랜을 만들 수 없어요."
      : "OPENAI_API_KEY is missing, so we could not generate an AI plan.";
  }

  if (message.includes("timed out")) {
    return locale === "ko"
      ? "AI 응답이 너무 오래 걸려 규칙 기반 초안을 먼저 보여드릴게요."
      : "The AI response took too long, so we returned the draft plan.";
  }

  if (message.includes("already in progress")) {
    return locale === "ko"
      ? "AI 플랜 생성이 이미 진행 중이에요. 잠시 후 다시 시도해 주세요."
      : "AI plan generation is already in progress. Please try again in a moment.";
  }

  if (message.includes("rate limit")) {
    return locale === "ko"
      ? "AI 플랜 요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
      : "Too many AI plan requests were sent. Please try again shortly.";
  }

  if (message.includes("openai request failed")) {
    return locale === "ko"
      ? "OpenAI 요청이 실패해 AI 플랜을 만들 수 없어요. 잠시 후 다시 시도해 주세요."
      : "The OpenAI request failed, so we could not generate an AI plan.";
  }

  return fallback;
}

function claimAiGenerationSlot(userId?: string) {
  if (!userId) {
    return () => undefined;
  }

  const inflightUsers = getInflightUsers();

  if (inflightUsers.has(userId)) {
    throw new OpenAIRequestError("AI generation already in progress for this user.");
  }

  inflightUsers.add(userId);

  return () => {
    inflightUsers.delete(userId);
  };
}

function enforceAiUsageLimit(userId?: string) {
  if (!userId) {
    return null;
  }

  return consumeRateLimits("habit-ai", userId, API_RATE_LIMITS.ai);
}

export async function generateBehaviorSwarm(
  rawInput: OnboardingBaseInput,
  options?: {
    locale?: Locale;
    strategy?: GenerationStrategy;
    modelPreference?: ModelPreference;
    userId?: string;
  },
): Promise<BehaviorSwarmCandidate[]> {
  const startedAt = Date.now();
  const input = onboardingBaseSchema.parse(rawInput);
  const locale = options?.locale ?? "ko";
  const strategy = options?.strategy ?? readGenerationStrategy();
  const modelPreference = options?.modelPreference ?? "fast";
  const draft = buildRuleBasedBehaviorSwarm(input, locale);

  if (strategy === "rules_only") {
    logGenerationMetrics({
      strategy,
      plannerMs: 0,
      openaiMs: 0,
      totalMs: Date.now() - startedAt,
      usedFallback: false,
    });
    return draft;
  }

  const rateLimitResult = enforceAiUsageLimit(options?.userId);

  if (rateLimitResult && !rateLimitResult.allowed) {
    return draft;
  }

  const releaseSlot = claimAiGenerationSlot(options?.userId);
  const openAIStartedAt = Date.now();

  try {
    const result = await callOpenAIStructured(
      buildBehaviorSwarmPrompt(input, locale),
      behaviorSwarmJsonSchema,
      modelPreference,
      (text) => {
        const parsed = JSON.parse(text) as { candidates: BehaviorSwarmCandidate[] };
        return behaviorSwarmSchema.parse(parsed.candidates);
      },
    );

    logGenerationMetrics({
      strategy,
      model: result.model,
      plannerMs: 0,
      openaiMs: Date.now() - openAIStartedAt,
      totalMs: Date.now() - startedAt,
      usedFallback: false,
      ...result.usage,
    });

    return result.data;
  } catch {
    logGenerationMetrics({
      strategy,
      model: pickModel(modelPreference),
      plannerMs: 0,
      openaiMs: Date.now() - openAIStartedAt,
      totalMs: Date.now() - startedAt,
      usedFallback: true,
    });
    return draft;
  } finally {
    releaseSlot();
  }
}

export async function generateHabitDecomposition(
  input: OnboardingInput,
  options?: {
    failureReason?: FailureReason;
    locale?: Locale;
    allowMockFallback?: boolean;
    strategy?: GenerationStrategy;
    modelPreference?: ModelPreference;
    userId?: string;
    goalId?: string;
    basedOnPlanId?: string;
  },
): Promise<HabitDecomposition> {
  const startedAt = Date.now();
  const failureReason = options?.failureReason;
  const locale = options?.locale ?? "ko";
  const allowRulesFallback = true;
  const strategy = options?.strategy ?? readGenerationStrategy();
  const modelPreference = options?.modelPreference ?? "fast";
  const classification = getGoalClassification(input.goal);
  const recentContext = await collectRecentContext({
    userId: options?.userId,
    goalId: options?.goalId,
    basedOnPlanId: options?.basedOnPlanId,
  });

  const plannerStartedAt = Date.now();
  const draft = buildRuleBasedHabitDecomposition(input, recentContext, {
    locale,
    failureReason,
  });
  const plannerMs = Date.now() - plannerStartedAt;

  if (strategy === "rules_only") {
    logGenerationMetrics({
      strategy,
      plannerMs,
      openaiMs: 0,
      totalMs: Date.now() - startedAt,
      usedFallback: false,
    });
    return draft;
  }

  if (strategy === "hybrid" && !shouldRewriteDraft(classification, input, failureReason)) {
    logGenerationMetrics({
      strategy,
      plannerMs,
      openaiMs: 0,
      totalMs: Date.now() - startedAt,
      usedFallback: false,
    });
    return draft;
  }

  const rateLimitResult = enforceAiUsageLimit(options?.userId);

  if (rateLimitResult && !rateLimitResult.allowed) {
    const error = new OpenAIRequestError("AI generation rate limit exceeded.");

    logSecurityEvent({
      type: "ai_generation_rate_limited",
      level: "warn",
      userId: options?.userId,
      outcome: allowRulesFallback ? "fallback" : "blocked",
      statusCode: 429,
      detail: {
        policy: rateLimitResult.rule.name,
      },
    });

    if (!allowRulesFallback) {
      throw new Error(buildAiUnavailableMessage(error, locale));
    }

    return draft;
  }

  const releaseSlot = claimAiGenerationSlot(options?.userId);
  const openAIStartedAt = Date.now();

  try {
    const prompt =
      strategy === "hybrid"
        ? buildHybridRewritePrompt(input, classification, stripSource(draft), failureReason, locale)
        : buildAiOnlyHabitDecompositionPrompt(input, classification, failureReason, locale);

    const result = await callOpenAIStructured(prompt, habitDecompositionJsonSchema, modelPreference, (text) => {
      const parsed = JSON.parse(text) as Omit<HabitDecomposition, "source">;
      validateDecompositionLocale(parsed, input, locale);

      return normalizeDecomposition(parsed, input, strategy === "hybrid" ? "hybrid" : "openai", failureReason, locale);
    });
    const openaiMs = Date.now() - openAIStartedAt;

    logGenerationMetrics({
      strategy,
      model: result.model,
      plannerMs,
      openaiMs,
      totalMs: Date.now() - startedAt,
      usedFallback: false,
      ...result.usage,
    });

    return result.data;
  } catch (error) {
    const openaiMs = Date.now() - openAIStartedAt;

    logSecurityEvent({
      type: "ai_generation_failed",
      level: allowRulesFallback ? "warn" : "error",
      userId: options?.userId,
      outcome: allowRulesFallback ? "fallback" : "error",
      statusCode: error instanceof OpenAIRequestError ? error.status : undefined,
      detail: {
        strategy,
        model: pickModel(modelPreference),
        goalId: options?.goalId ?? "",
        basedOnPlanId: options?.basedOnPlanId ?? "",
        reason: error instanceof Error ? error.message.slice(0, 240) : "unknown",
      },
    });

    logGenerationMetrics({
      strategy,
      model: pickModel(modelPreference),
      plannerMs,
      openaiMs,
      totalMs: Date.now() - startedAt,
      usedFallback: true,
    });

    return draft;
  } finally {
    releaseSlot();
  }
}

export async function generateMicroActions(input: OnboardingInput): Promise<MicroAction[]> {
  const decomposition = await generateHabitDecomposition(input);
  return decomposition.microActions.map((item) => microActionSchema.parse(item));
}
