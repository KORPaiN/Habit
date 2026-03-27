import type { Locale } from "@/lib/locale";
import { buildAnchorLabel } from "@/lib/utils/habit";
import { buildHabitDecompositionPrompt, habitDecompositionJsonSchema } from "@/lib/ai/prompt";
import { habitDecompositionSchema, microActionSchema, type HabitDecomposition, type MicroAction, type OnboardingInput } from "@/lib/validators/habit";
import type { FailureReason } from "@/types";

type OpenAIResponsePayload = {
  output_text?: string;
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
  locale: Locale = "en",
): MicroAction {
  const baseDuration = clampDuration(action.durationMinutes, input.difficulty);
  const shouldShrink = input.difficulty === "hard" || failureReason === "too_big";

  const durationMinutes = shouldShrink ? Math.min(baseDuration, 2) : baseDuration;
  const fallbackAction =
    failureReason === "too_big" && !/^touch |^open |^read one |^write one |^set out /i.test(action.fallbackAction)
      ? locale === "ko"
        ? `"${input.goal}"에 필요한 것을 열고 여기서 멈추기`
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
  locale: Locale = "en",
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

  throw new Error("OpenAI response did not contain structured text.");
}

export function buildMockHabitDecomposition(
  input: OnboardingInput,
  failureReason?: FailureReason,
  locale: Locale = "en",
): HabitDecomposition {
  const maxDuration = input.difficulty === "hard" ? 2 : Math.min(input.availableMinutes, 5);
  const firstDuration = Math.max(1, Math.min(maxDuration, input.difficulty === "hard" ? 1 : 2));

  const firstFallback =
    failureReason === "too_big"
      ? locale === "ko"
        ? `"${input.goal}"에 필요한 것을 열고 멈추기`
        : `Open what you need for "${input.goal}" and stop there`
      : input.goal.toLowerCase().includes("read")
        ? locale === "ko"
          ? "한 문장만 읽기"
          : "Read one sentence"
        : input.goal.toLowerCase().includes("write")
          ? locale === "ko"
            ? "세 단어만 쓰기"
            : "Write three words"
          : locale === "ko"
            ? "필요한 도구만 만지고 멈추기"
            : "Touch the tool you need and stop there";

  const firstAction = {
    title: input.goal.toLowerCase().includes("write")
      ? locale === "ko"
        ? "메모 앱을 열고 한 문장만 쓰기"
        : "Open your notes app and write one sentence"
      : input.goal.toLowerCase().includes("read")
        ? locale === "ko"
          ? "책을 펴고 한 페이지만 읽기"
          : "Open your book and read one page"
        : locale === "ko"
          ? `"${input.goal}"의 첫 작은 준비를 해두기`
          : `Set up the first tiny step for "${input.goal}"`,
    reason: locale === "ko" ? "눈에 보이고 구체적인 한 단계가 긴 세션보다 시작하기 쉽습니다." : "A visible, specific step is easier to start than a full session.",
    durationMinutes: firstDuration,
    fallbackAction: firstFallback,
  } satisfies MicroAction;

  return habitDecompositionSchema.parse({
    goalSummary:
      locale === "ko"
        ? `"${input.goal}"을 더 가볍게 시작해 오늘은 눈에 보이는 아주 작은 단계 하나만 하도록 합니다.`
        : `Start a lighter version of "${input.goal}" so today only asks for a tiny visible step.`,
    selectedAnchor: buildAnchorLabel(input.anchor, locale),
    microActions: [
      firstAction,
      {
        title: input.goal.toLowerCase().includes("write")
          ? locale === "ko"
            ? "나중에 돌아올 아이디어 하나 적기"
            : "List one idea you could return to later"
          : input.goal.toLowerCase().includes("read")
            ? locale === "ko"
              ? "유용한 문장 하나 표시하기"
              : "Highlight one useful line"
            : locale === "ko"
              ? `"${input.goal}"에 필요한 것 하나 준비하기`
              : `Prepare one thing you need for "${input.goal}"`,
        reason: locale === "ko" ? "준비는 다음 시도의 마찰을 줄여줍니다." : "Preparation lowers friction for the next attempt.",
        durationMinutes: Math.min(maxDuration, input.difficulty === "hard" ? 1 : 3),
        fallbackAction:
          failureReason === "too_big"
            ? locale === "ko"
              ? "필요한 도구만 만지기"
              : "Touch the tool you need"
            : locale === "ko"
              ? "도구를 보이는 곳에 두기"
              : "Place the tool where you can see it",
      },
      {
        title: input.goal.toLowerCase().includes("write")
          ? locale === "ko"
            ? "어제 쓴 문장을 읽고 한 문장 더 쓰기"
            : "Read yesterday's sentence and add one more"
          : input.goal.toLowerCase().includes("read")
            ? locale === "ko"
              ? "내일 읽을 책을 꺼내두기"
              : "Set out tomorrow's book"
            : locale === "ko"
              ? `"${input.goal}"의 내일 첫 단계를 미리 꺼내두기`
              : `Leave tomorrow's first step ready for "${input.goal}"`,
        reason: locale === "ko" ? "내일의 시작이 반쯤 준비되어 있으면 다시 시작하기 쉬워집니다." : "Restarting gets easier when tomorrow already begins half-done.",
        durationMinutes: Math.min(maxDuration, input.difficulty === "hard" ? 1 : 3),
        fallbackAction:
          failureReason === "too_big"
            ? locale === "ko"
              ? "도구를 보기만 하고 멈추기"
              : "Look at the tool and stop"
            : locale === "ko"
              ? "도구를 눈에 띄는 곳으로 옮기기"
              : "Move the tool into sight",
      },
    ],
    todayAction: firstAction,
    fallbackAction: firstFallback,
    source: "mock",
  });
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5";
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as OpenAIResponsePayload;
}

export async function generateHabitDecomposition(
  input: OnboardingInput,
  options?: { failureReason?: FailureReason; locale?: Locale },
): Promise<HabitDecomposition> {
  const failureReason = options?.failureReason;
  const locale = options?.locale ?? "en";

  try {
    const prompt = buildHabitDecompositionPrompt(input, failureReason, locale);
    const payload = await callOpenAI(prompt);
    const text = extractTextFromResponse(payload);
    const parsed = JSON.parse(text) as Omit<HabitDecomposition, "source">;

    return normalizeDecomposition(parsed, input, "openai", failureReason, locale);
  } catch {
    return buildMockHabitDecomposition(input, failureReason, locale);
  }
}

export async function generateMicroActions(input: OnboardingInput): Promise<MicroAction[]> {
  const decomposition = await generateHabitDecomposition(input);
  return decomposition.microActions.map((item) => microActionSchema.parse(item));
}
