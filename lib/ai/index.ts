import type { Locale } from "@/lib/locale";
import { z } from "zod";
import {
  buildBehaviorSwarmPrompt,
  buildAiOnlyHabitDecompositionPrompt,
  buildHybridRewritePrompt,
  behaviorSwarmJsonSchema,
  habitDecompositionJsonSchema,
  type GoalArchetype,
  type GoalClassification,
  type GoalIntent,
} from "@/lib/ai/prompt";
import { detectAnchorCueType, getDefaultLearnedAnchor, isStressReliefGoal, type AnchorCueType } from "@/lib/ai/anchor-patterns";
import { isLocalizedString, validateDecompositionLocale } from "@/lib/ai/locale-validation";
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

type GenerationStrategy = "hybrid" | "ai_only" | "rules_only";
type ModelPreference = "fast" | "quality" | "experimental";
type RecentContext = {
  recentStatuses: string[];
  recentFailureReasons: string[];
  recentUsedFallbackCount: number;
  recentCompletedStreak: number;
  usedUserLevelPattern: boolean;
};
type DraftTemplate = {
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

function getAiQualityPatterns(locale: Locale) {
  if (locale === "ko") {
    return {
      bannedSummary: /(인생|변화시키|완전히|이번 주|꾸준한 루틴|동기|의지|열심히|성공할 수)/,
      bannedReason: /(의지|동기|꾸준|성장|변화|성공|잘 해낼|완벽)/,
    };
  }

  return {
    bannedSummary: /(life reset|transform|whole new|weekly plan|motivation|discipline|consistency)/i,
    bannedReason: /(motivation|discipline|consistency|mindset|success|transform)/i,
  };
}

function hasSmallActionCue(title: string, classification: GoalClassification) {
  const normalized = title.toLowerCase();

  switch (classification.archetype) {
    case "reading":
      return /책|줄|문장|펴|bookmark|line|sentence|open/.test(normalized);
    case "writing":
      return /메모|문장|제목|키워드|열|notes|sentence|title|keyword|open/.test(normalized);
    case "study":
      return /페이지|줄|교재|도구|page|line|material|tool|open/.test(normalized);
    case "exercise":
      return /1분|운동화|매트|스트레칭|minute|shoes|mat|stretch|put on/.test(normalized);
    case "tidy":
      return /하나|칸|자리|spot|item|one/.test(normalized);
    case "digital":
      return /앱 하나|알림 하나|설정|app|notification|settings|one/.test(normalized);
    case "self_care":
      return /한 컵|숨|컵|glass|breath|cup|one/.test(normalized);
    default:
      return /하나|첫|준비|one|first|open|take out|look/.test(normalized);
  }
}

function hasOversizedCue(title: string, classification: GoalClassification) {
  const normalized = title.toLowerCase();

  switch (classification.archetype) {
    case "reading":
      return /페이지|chapter|챕터|독서|read for|session|long/.test(normalized) && !/한 줄|one line|문장|sentence/.test(normalized);
    case "writing":
      return /에세이|블로그|단락|paragraph|journal entry|essay|post/.test(normalized);
    case "study":
      return /세트|full|lesson|강의|session|chapter|문제들/.test(normalized);
    case "exercise":
      return /workout|러닝|운동하기|full|session|30분|20분/.test(normalized);
    case "tidy":
      return /방|서랍 전체|전체|room|closet|deep clean/.test(normalized);
    case "digital":
      return /detox|정리하기|reset|cleanup|전체 정리/.test(normalized);
    case "self_care":
      return /routine|루틴|session|full/.test(normalized);
    default:
      return /finish|complete|full|session|transform/.test(normalized);
  }
}

function isReasonTooLong(reason: string, locale: Locale) {
  return locale === "ko" ? reason.trim().length > 28 : reason.trim().length > 110;
}

function isSummaryTooLong(summary: string, locale: Locale) {
  return locale === "ko" ? summary.trim().length > 40 : summary.trim().length > 120;
}

function assertAiDecompositionQuality(
  decomposition: HabitDecomposition,
  input: OnboardingInput,
  classification: GoalClassification,
  locale: Locale,
  draft?: HabitDecomposition,
) {
  const patterns = getAiQualityPatterns(locale);

  if (isSummaryTooLong(decomposition.goalSummary, locale) || patterns.bannedSummary.test(decomposition.goalSummary)) {
    throw new Error("AI decomposition summary quality was too low.");
  }

  if (decomposition.todayAction.title.trim() === decomposition.fallbackAction.trim()) {
    throw new Error("AI decomposition fallback was identical to the main action.");
  }

  if (!hasSmallActionCue(decomposition.todayAction.title, classification) || hasOversizedCue(decomposition.todayAction.title, classification)) {
    throw new Error("AI decomposition main action was too large for the requested tone.");
  }

  if (isReasonTooLong(decomposition.todayAction.reason, locale) || patterns.bannedReason.test(decomposition.todayAction.reason)) {
    throw new Error("AI decomposition reason quality was too low.");
  }

  for (const action of decomposition.microActions) {
    if (action.title.trim() === action.fallbackAction.trim()) {
      throw new Error("AI decomposition contained an identical fallback.");
    }

    if (isReasonTooLong(action.reason, locale) || patterns.bannedReason.test(action.reason)) {
      throw new Error("AI decomposition contained an overly long or motivational reason.");
    }
  }

  if (draft && decomposition.todayAction.durationMinutes > draft.todayAction.durationMinutes + 1) {
    throw new Error("AI decomposition expanded the first action too much.");
  }

  if (input.difficulty === "hard" && decomposition.todayAction.durationMinutes > 2) {
    throw new Error("AI decomposition exceeded the hard difficulty limit.");
  }
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

  if (/sleep|rest|water|meditat|care|health|stress|anxiety|calm|breath|gratitude|수면|휴식|물 마시|건강|마음챙김|스트레스|불안|차분|진정|호흡|숨|명상|감사/.test(normalized)) {
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

function createMicroAction(
  locale: Locale,
  copy: {
    ko: { title: string; reason: string; fallbackAction: string };
    en: { title: string; reason: string; fallbackAction: string };
  },
  durationMinutes: number,
): MicroAction {
  const localized = locale === "ko" ? copy.ko : copy.en;

  return microActionSchema.parse({
    ...localized,
    durationMinutes,
  });
}

function buildStressRuleActions(
  input: OnboardingInput,
  failureReason: FailureReason | undefined,
  locale: Locale,
): MicroAction[] {
  const { primary, secondary } = getActionDurations(input);
  const smallerPrimary = failureReason === "too_big" ? 1 : primary;
  const cueType = detectAnchorCueType(input.anchor);

  switch (cueType) {
    case "morning":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "창문 열고 숨 세 번 쉬기",
              reason: "몸부터 가볍게 깨우면 긴장이 덜 남아요.",
              fallbackAction: "창문만 열기",
            },
            en: {
              title: "Open a window and take three slow breaths",
              reason: "A physical reset makes the morning feel lighter.",
              fallbackAction: "Open the window and stop",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "물 한 컵 따르기",
              reason: "작은 돌봄부터 시작하면 압박이 줄어요.",
              fallbackAction: "컵만 꺼내기",
            },
            en: {
              title: "Pour one glass of water",
              reason: "A tiny act of care lowers the pressure.",
              fallbackAction: "Take out a cup",
            },
          },
          secondary,
        ),
      ];
    case "shower":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "샤워 물 틀고 숨 세 번 쉬기",
              reason: "물 소리에 맞춰 멈추면 몸이 먼저 풀려요.",
              fallbackAction: "샤워 물만 틀기",
            },
            en: {
              title: "Turn on the shower and take three slow breaths",
              reason: "Pausing with the water sound helps your body settle first.",
              fallbackAction: "Turn on the shower and stop",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "어깨 힘 한 번 빼기",
              reason: "짧은 이완만으로도 긴장이 조금 내려갑니다.",
              fallbackAction: "고개 한 번 돌리기",
            },
            en: {
              title: "Drop your shoulders once",
              reason: "A quick release is enough to lower the tension a little.",
              fallbackAction: "Roll your neck once",
            },
          },
          secondary,
        ),
      ];
    case "coffee":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "컵 내려놓고 숨 세 번 쉬기",
              reason: "멈추는 신호가 분명해서 바로 붙기 쉬워요.",
              fallbackAction: "컵 내려놓기",
            },
            en: {
              title: "Set the cup down and take three slow breaths",
              reason: "The cue is clear, so it is easy to attach right away.",
              fallbackAction: "Set the cup down",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "노트 열고 한 줄 적기",
              reason: "머릿속 긴장을 밖으로 조금 꺼내둡니다.",
              fallbackAction: "노트만 열기",
            },
            en: {
              title: "Open a journal and write one line",
              reason: "One line is enough to move some of the stress out of your head.",
              fallbackAction: "Open the journal and stop",
            },
          },
          secondary,
        ),
      ];
    case "midday":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "밖으로 나가 1분 걷기",
              reason: "점심 뒤엔 몸을 조금 움직이면 머리가 가벼워져요.",
              fallbackAction: "문밖 공기 한 번 마시기",
            },
            en: {
              title: "Step outside and walk for one minute",
              reason: "A little movement after lunch clears the head quickly.",
              fallbackAction: "Step to the door and take one breath of outside air",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "휴대폰 없이 하늘 보기",
              reason: "시선을 멀리 두면 긴장이 한 번 끊겨요.",
              fallbackAction: "창밖 보기",
            },
            en: {
              title: "Look at the sky without your phone",
              reason: "Looking farther away gives the tension a clean break.",
              fallbackAction: "Look out the window",
            },
          },
          secondary,
        ),
      ];
    case "appointment":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "휴대폰 뒤집고 숨 세 번 쉬기",
              reason: "기다리는 시간에 자극을 하나 줄이면 훨씬 차분해져요.",
              fallbackAction: "휴대폰 뒤집기",
            },
            en: {
              title: "Turn your phone over and take three slow breaths",
              reason: "Removing one source of stimulation helps you settle while you wait.",
              fallbackAction: "Turn your phone over",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "어깨 힘 빼고 발바닥 느끼기",
              reason: "몸 감각으로 돌아오면 긴장이 덜 커져요.",
              fallbackAction: "어깨 한 번 내리기",
            },
            en: {
              title: "Drop your shoulders and feel your feet",
              reason: "Returning to the body keeps the tension from growing.",
              fallbackAction: "Drop your shoulders once",
            },
          },
          secondary,
        ),
      ];
    case "commute":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "눈 감고 숨 세 번 세기",
              reason: "이동 중엔 짧은 호흡이 가장 붙기 쉬워요.",
              fallbackAction: "숨 한 번 세기",
            },
            en: {
              title: "Close your eyes and count three breaths",
              reason: "A short breathing reset is easy to do during transit.",
              fallbackAction: "Count one breath",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "명상 앱 열고 1분 듣기",
              reason: "바로 틀 수 있는 진정 신호를 하나 만듭니다.",
              fallbackAction: "명상 앱만 열기",
            },
            en: {
              title: "Open your meditation app and listen for one minute",
              reason: "Give yourself one ready-made calming cue.",
              fallbackAction: "Open the meditation app",
            },
          },
          secondary,
        ),
      ];
    case "request":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "답장 전에 숨 세 번 쉬기",
              reason: "바로 반응하지 않으면 압박이 조금 줄어요.",
              fallbackAction: "답장창 잠깐 닫기",
            },
            en: {
              title: "Take three slow breaths before replying",
              reason: "Not reacting right away takes some pressure off.",
              fallbackAction: "Close the reply box for a moment",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "지금 가능한지만 한 줄 적기",
              reason: "설명보다 경계부터 분명히 하면 덜 지쳐요.",
              fallbackAction: "가능 여부만 적기",
            },
            en: {
              title: "Write one line about what is possible right now",
              reason: "Naming the boundary first costs less energy than explaining everything.",
              fallbackAction: "Write only yes or no",
            },
          },
          secondary,
        ),
      ];
    case "conflict":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "물 한 컵 마시기",
              reason: "몸을 먼저 진정시키면 감정이 덜 커집니다.",
              fallbackAction: "컵에 물 따르기",
            },
            en: {
              title: "Drink one glass of water",
              reason: "Calming the body first keeps the emotion from growing.",
              fallbackAction: "Pour water into a cup",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "문 쪽까지 걸어갔다 오기",
              reason: "짧은 거리 이동만으로도 긴장이 한번 끊겨요.",
              fallbackAction: "문 쪽 보기",
            },
            en: {
              title: "Walk to the door and back",
              reason: "A very short movement can interrupt the tension.",
              fallbackAction: "Look toward the door",
            },
          },
          secondary,
        ),
      ];
    case "outside":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "보이는 나무 하나 보기",
              reason: "시선을 바깥에 두면 머리 과열이 조금 식어요.",
              fallbackAction: "하늘 한번 보기",
            },
            en: {
              title: "Look at one tree you can see",
              reason: "Putting your eyes on the outside world cools the mind a little.",
              fallbackAction: "Look at the sky once",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "걸음 다섯 번 천천히 걷기",
              reason: "리듬을 늦추면 몸이 먼저 따라옵니다.",
              fallbackAction: "걸음 한 번 늦추기",
            },
            en: {
              title: "Walk five slow steps",
              reason: "Slowing the rhythm helps the body settle first.",
              fallbackAction: "Slow down one step",
            },
          },
          secondary,
        ),
      ];
    case "evening":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "허브티 물 올리기",
              reason: "저녁엔 따뜻한 준비 동작이 마음을 누그러뜨려요.",
              fallbackAction: "컵 하나 꺼내기",
            },
            en: {
              title: "Put water on for herbal tea",
              reason: "A warm setup action helps the evening feel softer.",
              fallbackAction: "Take out one cup",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "불 하나 끄기",
              reason: "자극을 하나 줄이면 밤 모드로 넘어가기 쉬워요.",
              fallbackAction: "스위치에 손 올리기",
            },
            en: {
              title: "Turn off one light",
              reason: "Removing one source of stimulation makes it easier to shift into night mode.",
              fallbackAction: "Put your hand on the switch",
            },
          },
          secondary,
        ),
      ];
    case "bedtime":
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "눈 감고 숨 세 번 세기",
              reason: "잠들기 전엔 짧은 호흡이 가장 부담이 적어요.",
              fallbackAction: "숨 한 번 세기",
            },
            en: {
              title: "Close your eyes and count three breaths",
              reason: "Right before sleep, a short breathing reset is the lightest option.",
              fallbackAction: "Count one breath",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "휴대폰 내려두고 눈 감기",
              reason: "마지막 자극을 끊으면 몸이 더 빨리 쉬어요.",
              fallbackAction: "휴대폰 내려두기",
            },
            en: {
              title: "Put your phone down and close your eyes",
              reason: "Cutting the last stimulation helps the body rest sooner.",
              fallbackAction: "Put your phone down",
            },
          },
          secondary,
        ),
      ];
    default:
      return [
        createMicroAction(
          locale,
          {
            ko: {
              title: "숨 세 번 쉬기",
              reason: "가장 빨리 할 수 있는 진정 동작부터 갑니다.",
              fallbackAction: "숨 한 번 쉬기",
            },
            en: {
              title: "Take three slow breaths",
              reason: "Start with the quickest calming action you can do right now.",
              fallbackAction: "Take one slow breath",
            },
          },
          smallerPrimary,
        ),
        createMicroAction(
          locale,
          {
            ko: {
              title: "물 한 컵 따르기",
              reason: "몸을 돌보는 작은 동작이 압박을 낮춰줘요.",
              fallbackAction: "컵만 꺼내기",
            },
            en: {
              title: "Pour one glass of water",
              reason: "A tiny act of care lowers the pressure.",
              fallbackAction: "Take out a cup",
            },
          },
          secondary,
        ),
      ];
  }
}

function buildStressMinimalAction(input: OnboardingInput, locale: Locale): MicroAction {
  const cueType: AnchorCueType = detectAnchorCueType(input.anchor);

  switch (cueType) {
    case "coffee":
      return microActionSchema.parse({
        title: locale === "ko" ? "컵 내려놓고 숨 한 번 쉬기" : "Set the cup down and take one breath",
        reason: locale === "ko" ? "멈추는 신호만 남겨도 충분해요." : "Keeping only the pause is enough for now.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "컵 내려놓기" : "Set the cup down",
      });
    case "midday":
    case "outside":
      return microActionSchema.parse({
        title: locale === "ko" ? "문밖 공기 한 번 마시기" : "Take one breath of outside air",
        reason: locale === "ko" ? "몸을 밖으로 조금만 돌려도 흐름이 바뀌어요." : "Turning your body outward a little is enough to change the rhythm.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "문 쪽 보기" : "Look toward the door",
      });
    case "appointment":
    case "commute":
      return microActionSchema.parse({
        title: locale === "ko" ? "휴대폰 뒤집고 숨 한 번 쉬기" : "Turn your phone over and take one breath",
        reason: locale === "ko" ? "자극 하나만 줄여도 긴장이 덜 커져요." : "Removing one source of stimulation keeps the tension smaller.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "휴대폰 뒤집기" : "Turn your phone over",
      });
    case "request":
    case "conflict":
      return microActionSchema.parse({
        title: locale === "ko" ? "물 한 컵 따르기" : "Pour one glass of water",
        reason: locale === "ko" ? "바로 반응하기 전에 몸부터 진정시켜요." : "Calm the body before you react.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "컵만 꺼내기" : "Take out a cup",
      });
    case "evening":
    case "bedtime":
      return microActionSchema.parse({
        title: locale === "ko" ? "불 하나 끄기" : "Turn off one light",
        reason: locale === "ko" ? "밤 모드로 넘어가는 신호만 만들면 돼요." : "You only need a small signal that it is time to slow down.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "스위치에 손 올리기" : "Put your hand on the switch",
      });
    default:
      return microActionSchema.parse({
        title: locale === "ko" ? "숨 한 번 크게 쉬기" : "Take one slow breath",
        reason: locale === "ko" ? "가장 작은 진정 동작이면 충분해요." : "The smallest calming action is enough for today.",
        durationMinutes: 1,
        fallbackAction: locale === "ko" ? "어깨 힘 빼기" : "Drop your shoulders once",
      });
  }
}

function buildRuleActions(
  archetype: GoalArchetype,
  input: OnboardingInput,
  failureReason?: FailureReason,
  locale: Locale = "ko",
): MicroAction[] {
  if (isStressReliefGoal(input.goal)) {
    return buildStressRuleActions(input, failureReason, locale);
  }

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
          fallbackAction: locale === "ko" ? "공부 책을 책상 위에 올리기" : "Place your study book on the desk",
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
  if (isStressReliefGoal(input.goal)) {
    return buildStressMinimalAction(input, locale);
  }

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
  const { source, ...rest } = decomposition;
  void source;
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

export async function collectRecentContext(input: {
  userId?: string;
  goalId?: string;
  basedOnPlanId?: string;
}): Promise<RecentContext> {
  void input;
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

  if (
    /열|펴|꺼내|놓|보기|닫기|신기|한 줄|한 문장|한 컵|한 칸|숨|호흡|불 하나|휴대폰 뒤집|하늘 보기|창문 열기|one line|one sentence|open|take out|close|put on|breath|light|phone|sky|window/i.test(
      title,
    )
  ) {
    score += 1;
  }

  return Math.max(1, Math.min(5, score));
}

function scoreImpact(title: string, classification: GoalClassification) {
  let score = 3;

  if (classification.archetype !== "generic") {
    score += 1;
  }

  if (/첫|한 줄|한 문장|한 컵|앱 하나|물건 하나|한 칸|숨 세 번|불 하나|1분 걷기|one line|one sentence|one glass|one item|three breaths|one light|one minute/i.test(title)) {
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
  const anchor = isStressReliefGoal(input.goal)
    ? getDefaultLearnedAnchor(input.preferredTime, "ko")
    : input.preferredTime === "evening"
      ? "잠들기 전"
      : "커피 마신 뒤";

  return onboardingBaseSchema
    .extend({
      anchor: z.string().default(anchor),
    })
    .parse({
      ...input,
      anchor,
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
      title: `"${input.goal}" 할 화면 한 개 열기`,
      reason: "바로 시작할 화면을 먼저 띄워요.",
      durationMinutes: 1,
      fallbackAction: `"${input.goal}" 할 화면 이름 말하기`,
    },
    {
      title: "한 문장만 보기",
      reason: "부담 없이 흐름을 다시 엽니다.",
      durationMinutes: 1,
      fallbackAction: "한 줄만 보기",
    },
    {
      title: "앉을 자리로 가기",
      reason: "시작할 자리까지 가면 붙기 쉬워져요.",
      durationMinutes: 1,
      fallbackAction: "앉을 자리 보기",
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

function sortBehaviorSwarmCandidates(
  candidates: Array<{
    candidate: BehaviorSwarmCandidate;
    originalIndex: number;
  }>,
) {
  return candidates.sort((left, right) => {
    if (left.candidate.durationMinutes !== right.candidate.durationMinutes) {
      return left.candidate.durationMinutes - right.candidate.durationMinutes;
    }

    if (left.candidate.abilityScore !== right.candidate.abilityScore) {
      return right.candidate.abilityScore - left.candidate.abilityScore;
    }

    if (left.candidate.impactScore !== right.candidate.impactScore) {
      return right.candidate.impactScore - left.candidate.impactScore;
    }

    if (left.candidate.desireScore !== right.candidate.desireScore) {
      return right.candidate.desireScore - left.candidate.desireScore;
    }

    return left.originalIndex - right.originalIndex;
  });
}

function isLocalizedBehaviorSwarmCandidate(candidate: BehaviorSwarmCandidate, input: OnboardingBaseInput, locale: Locale) {
  return isLocalizedString(candidate.title, locale, input.goal) && isLocalizedString(candidate.details ?? "", locale, input.goal);
}

function normalizeBehaviorSwarmCandidates(
  rawCandidates: unknown,
  draft: BehaviorSwarmCandidate[],
  input: OnboardingBaseInput,
  locale: Locale,
) {
  if (!Array.isArray(rawCandidates)) {
    throw new Error("Behavior swarm candidates were not an array.");
  }

  const seen = new Set<string>();
  const nextCandidates: Array<{ candidate: BehaviorSwarmCandidate; originalIndex: number }> = [];

  rawCandidates.forEach((rawCandidate, index) => {
    const parsed = behaviorSwarmCandidateSchema.safeParse(rawCandidate);

    if (!parsed.success) {
      return;
    }

    if (!isLocalizedBehaviorSwarmCandidate(parsed.data, input, locale)) {
      return;
    }

    const key = parsed.data.title.trim().toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    nextCandidates.push({ candidate: parsed.data, originalIndex: index });
  });

  for (const candidate of draft) {
    if (nextCandidates.length >= 6) {
      break;
    }

    const key = candidate.title.trim().toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextCandidates.push({ candidate, originalIndex: rawCandidates.length + nextCandidates.length });
  }

  if (nextCandidates.length < 6) {
    return draft;
  }

  return behaviorSwarmSchema.parse(sortBehaviorSwarmCandidates(nextCandidates).slice(0, 10).map(({ candidate }) => candidate));
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
    if (/숨|호흡/i.test(selectedBehavior.title)) return "숨 한 번 쉬기";
    if (/휴대폰|폰/i.test(selectedBehavior.title)) return "휴대폰 뒤집기";
    if (/명상 앱/i.test(selectedBehavior.title)) return "명상 앱만 열기";
    if (/노트|일기|저널|감사/i.test(selectedBehavior.title)) return "노트만 열기";
    if (/불|조명/i.test(selectedBehavior.title)) return "스위치에 손 올리기";
    if (/물|차|티/i.test(selectedBehavior.title)) return "컵만 꺼내기";
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
        const parsed = JSON.parse(text) as { candidates?: unknown };
        return normalizeBehaviorSwarmCandidates(parsed.candidates, draft, input, locale);
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
      const normalized = normalizeDecomposition(parsed, input, strategy === "hybrid" ? "hybrid" : "openai", failureReason, locale);
      assertAiDecompositionQuality(normalized, input, classification, locale, draft);
      return normalized;
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
