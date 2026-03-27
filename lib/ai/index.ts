import type { Locale } from "@/lib/locale";
import {
  buildAiOnlyHabitDecompositionPrompt,
  buildHybridRewritePrompt,
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
  habitDecompositionSchema,
  microActionSchema,
  type HabitDecomposition,
  type MicroAction,
  type OnboardingInput,
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
  return process.env.OPENAI_MODEL_FAST ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";
}

function getQualityModel() {
  return process.env.OPENAI_MODEL_QUALITY ?? "gpt-5";
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

function getOpenAITimeoutMs() {
  const raw = Number(process.env.OPENAI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 10000;
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
    ? `"${goal}"을 오늘 바로 할 수 있는 작은 행동으로 줄였어요.`
    : `We turned "${goal}" into a tiny action you can do today.`;
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
          title: locale === "ko" ? "책을 펴고 한 페이지 읽기" : "Open your book and read one page",
          reason: locale === "ko" ? "한 페이지면 바로 시작할 수 있어요." : "One page is easy enough to start.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "책만 펴고 끝내기"
              : "Open the book and stop"
            : locale === "ko"
              ? "책을 펴고 한 문장 읽기"
              : "Open the book and read one sentence",
        },
        {
          title: locale === "ko" ? "마음에 든 한 줄 표시하기" : "Highlight one useful line",
          reason: locale === "ko" ? "한 줄만 남겨도 흐름이 이어져요." : "One line is enough to keep the loop going.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "한 줄만 보기" : "Look at one line only",
        },
      ];
    case "writing":
      return [
        {
          title: locale === "ko" ? "메모 앱을 열고 한 문장 쓰기" : "Open your notes app and write one sentence",
          reason: locale === "ko" ? "한 문장이면 시작하기 충분해요." : "One sentence is enough to begin.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? "메모 앱만 열기"
              : "Open your notes app and stop"
            : locale === "ko"
              ? "단어 세 개 쓰기"
              : "Write three words",
        },
        {
          title: locale === "ko" ? "이어 쓸 생각 하나 적기" : "Write down one idea to continue later",
          reason: locale === "ko" ? "생각 하나면 다음 시작이 쉬워져요." : "One idea makes the next start easier.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "제목만 적기" : "Write only a title",
        },
      ];
    case "study":
      return [
        {
          title: locale === "ko" ? "공부할 페이지를 펴고 핵심 한 줄 읽기" : "Open the page you will study and read one key line",
          reason: locale === "ko" ? "첫 줄만 봐도 시작 장벽이 낮아져요." : "A single line lowers the barrier to start.",
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
          title: locale === "ko" ? "문제 하나만 보기" : "Look at just one problem",
          reason: locale === "ko" ? "문제 하나만 봐도 흐름이 다시 잡혀요." : "One problem is enough to restart the flow.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "문제 번호만 확인하기" : "Look at the problem number only",
        },
      ];
    case "exercise":
      return [
        {
          title: locale === "ko" ? "운동화 신고 1분 움직이기" : "Put on your shoes and move for one minute",
          reason: locale === "ko" ? "1분만 움직여도 시작은 충분해요." : "One minute is enough to begin.",
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
          title: locale === "ko" ? "스트레칭 한 동작 5번 하기" : "Do one stretch five times",
          reason: locale === "ko" ? "동작 하나면 부담이 확 줄어요." : "One movement keeps the effort small.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "스트레칭 한 번 하기" : "Stretch once",
        },
      ];
    case "tidy":
      return [
        {
          title: locale === "ko" ? "물건 하나 제자리에 두기" : "Put one item back in its place",
          reason: locale === "ko" ? "하나만 치워도 시작은 됩니다." : "One item is enough to start.",
          durationMinutes: primary,
          fallbackAction: locale === "ko" ? "물건 하나 집어 들기" : "Pick up one item",
        },
        {
          title: locale === "ko" ? "책상 한 칸만 정리하기" : "Tidy one small area of your desk",
          reason: locale === "ko" ? "한 칸만 정리해도 눈에 띄는 변화가 생겨요." : "One small area creates visible progress.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "책상 위 하나만 치우기" : "Put away one thing from your desk",
        },
      ];
    case "digital":
      return [
        {
          title: locale === "ko" ? "방해되는 앱 하나 닫기" : "Close one distracting app",
          reason: locale === "ko" ? "앱 하나만 닫아도 방해가 줄어요." : "Closing one app reduces friction right away.",
          durationMinutes: primary,
          fallbackAction: locale === "ko" ? "앱 하나 보기만 하기" : "Look at one app and stop",
        },
        {
          title: locale === "ko" ? "알림 하나 끄기" : "Turn off one notification",
          reason: locale === "ko" ? "알림 하나만 줄여도 흐름이 달라져요." : "One fewer alert makes the loop lighter.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "알림 설정 열기" : "Open notification settings",
        },
      ];
    case "self_care":
      return [
        {
          title: locale === "ko" ? "물 한 컵 마시기" : "Drink one glass of water",
          reason: locale === "ko" ? "작고 쉬운 돌봄부터 시작하면 됩니다." : "A small act of care is enough to begin.",
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
          reason: locale === "ko" ? "세 번이면 부담 없이 할 수 있어요." : "Three breaths are easy enough to do now.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "숨 한 번 크게 쉬기" : "Take one slow breath",
        },
      ];
    case "generic":
    default:
      return [
        {
          title: locale === "ko" ? `"${goal}"에 필요한 것 하나 꺼내기` : `Take out one thing you need for "${goal}"`,
          reason: locale === "ko" ? "준비부터 하면 시작이 쉬워져요." : "Preparation makes starting easier.",
          durationMinutes: primary,
          fallbackAction: tooBig
            ? locale === "ko"
              ? `"${goal}"에 필요한 것 만지기`
              : `Touch one thing you need for "${goal}"`
            : locale === "ko"
              ? `"${goal}"에 필요한 것 보기`
              : `Look at one thing you need for "${goal}"`,
        },
        {
          title: locale === "ko" ? `"${goal}"의 첫 단계 열어 보기` : `Open the first step for "${goal}"`,
          reason: locale === "ko" ? "첫 단계만 열어도 다시 시작하기 쉬워져요." : "Opening the first step makes it easier to begin.",
          durationMinutes: secondary,
          fallbackAction: locale === "ko" ? "첫 단계 제목만 보기" : "Look at the first-step title only",
        },
      ];
  }
}

function buildSmallerAction(archetype: GoalArchetype, input: OnboardingInput, locale: Locale): MicroAction {
  switch (archetype) {
    case "reading":
      return microActionSchema.parse({
        title: locale === "ko" ? "책을 펴고 한 줄 보기" : "Open the book and look at one line",
        reason: locale === "ko" ? "한 줄만 보면 다시 시작하기 쉬워져요." : "One line is enough to restart.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "책만 펴기" : "Open the book and stop",
      });
    case "writing":
      return microActionSchema.parse({
        title: locale === "ko" ? "메모 앱을 열고 단어 하나 쓰기" : "Open your notes app and write one word",
        reason: locale === "ko" ? "단어 하나면 부담 없이 시작할 수 있어요." : "One word keeps the barrier low.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "메모 앱만 열기" : "Open your notes app and stop",
      });
    case "exercise":
      return microActionSchema.parse({
        title: locale === "ko" ? "운동화만 꺼내기" : "Take out your shoes",
        reason: locale === "ko" ? "준비만 해도 다시 이어가기 쉬워져요." : "Preparation alone keeps the habit alive.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "운동화 보기" : "Look at your shoes",
      });
    case "tidy":
      return microActionSchema.parse({
        title: locale === "ko" ? "책상 위 물건 하나 들기" : "Pick up one item from your desk",
        reason: locale === "ko" ? "한 개만 움직여도 시작은 충분해요." : "Moving one item is enough to begin.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "책상 보기" : "Look at your desk",
      });
    default:
      return microActionSchema.parse({
        title: locale === "ko" ? `"${input.goal}"에 필요한 것 하나 열기` : `Open one thing you need for "${input.goal}"`,
        reason: locale === "ko" ? "준비만 해도 다시 시작이 쉬워져요." : "Opening the first thing lowers the barrier.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "필요한 것 만지기" : "Touch what you need and stop",
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
      candidate === "schedule_conflict" ||
      candidate === "low_motivation" ||
      candidate === "other",
    ) ??
      undefined);
  const shouldShrink =
    normalizedFailureReason === "too_big" || recentContext.recentUsedFallbackCount >= 2 || recentContext.recentStatuses.includes("failed");
  const shouldMentionAnchor = normalizedFailureReason === "forgot";
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
          ? `${input.anchor} 직후에 바로 할 수 있는 짧은 시작이에요.`
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
    "prepare",
    "continue",
    "review",
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenAIOnce(prompt: string, model: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new OpenAIRequestError("Missing OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeoutMs = getOpenAITimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        text: {
          format: {
            type: "json_schema",
            ...habitDecompositionJsonSchema,
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

async function callOpenAI(prompt: string, model: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchOpenAIOnce(prompt, model);
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
  const model = pickModel(modelPreference);
  const openAIStartedAt = Date.now();

  try {
    const prompt =
      strategy === "hybrid"
        ? buildHybridRewritePrompt(input, classification, stripSource(draft), failureReason, locale)
        : buildAiOnlyHabitDecompositionPrompt(input, classification, failureReason, locale);

    const payload = await callOpenAI(prompt, model);
    const openaiMs = Date.now() - openAIStartedAt;
    const text = extractTextFromResponse(payload);
    const parsed = JSON.parse(text) as Omit<HabitDecomposition, "source">;
    validateDecompositionLocale(parsed, input, locale);

    const decomposition = normalizeDecomposition(parsed, input, strategy === "hybrid" ? "hybrid" : "openai", failureReason, locale);
    const usage = getOpenAIUsage(payload);

    logGenerationMetrics({
      strategy,
      model,
      plannerMs,
      openaiMs,
      totalMs: Date.now() - startedAt,
      usedFallback: false,
      ...usage,
    });

    return decomposition;
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
        model,
        goalId: options?.goalId ?? "",
        basedOnPlanId: options?.basedOnPlanId ?? "",
      },
    });

    logGenerationMetrics({
      strategy,
      model,
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
