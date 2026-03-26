import { buildAnchorLabel } from "@/lib/habit";
import { buildHabitDecompositionPrompt, habitDecompositionJsonSchema } from "@/lib/prompts/habit-decomposition";
import { habitDecompositionSchema, microActionSchema, type HabitDecomposition, type MicroAction, type OnboardingInput } from "@/lib/schemas/habit";
import type { FailureReason } from "@/lib/types/database";

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

function maybeShrinkFallback(action: MicroAction, input: OnboardingInput, failureReason?: FailureReason): MicroAction {
  const baseDuration = clampDuration(action.durationMinutes, input.difficulty);
  const shouldShrink = input.difficulty === "hard" || failureReason === "too_big";

  const durationMinutes = shouldShrink ? Math.min(baseDuration, 2) : baseDuration;
  const fallbackAction =
    failureReason === "too_big" && !/^touch |^open |^read one |^write one |^set out /i.test(action.fallbackAction)
      ? `Open what you need for "${input.goal}" and stop there`
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
): HabitDecomposition {
  const microActions = raw.microActions
    .slice(0, 3)
    .map((action) => maybeShrinkFallback(action, input, failureReason));

  const todayActionCandidate =
    microActions.find((action) => action.title === raw.todayAction.title) ??
    microActions.find((action) => action.fallbackAction === raw.fallbackAction) ??
    microActions[0];

  if (!todayActionCandidate) {
    throw new Error("No valid micro-actions were generated.");
  }

  const todayAction = maybeShrinkFallback(todayActionCandidate, input, failureReason);
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

export function buildMockHabitDecomposition(input: OnboardingInput, failureReason?: FailureReason): HabitDecomposition {
  const maxDuration = input.difficulty === "hard" ? 2 : Math.min(input.availableMinutes, 5);
  const firstDuration = Math.max(1, Math.min(maxDuration, input.difficulty === "hard" ? 1 : 2));

  const firstFallback =
    failureReason === "too_big"
      ? `Open what you need for "${input.goal}" and stop there`
      : input.goal.toLowerCase().includes("read")
        ? "Read one sentence"
        : input.goal.toLowerCase().includes("write")
          ? "Write three words"
          : "Touch the tool you need and stop there";

  const firstAction = {
    title: input.goal.toLowerCase().includes("write")
      ? "Open your notes app and write one sentence"
      : input.goal.toLowerCase().includes("read")
        ? "Open your book and read one page"
        : `Set up the first tiny step for "${input.goal}"`,
    reason: "A visible, specific step is easier to start than a full session.",
    durationMinutes: firstDuration,
    fallbackAction: firstFallback,
  } satisfies MicroAction;

  return habitDecompositionSchema.parse({
    goalSummary: `Start a lighter version of "${input.goal}" so today only asks for a tiny visible step.`,
    selectedAnchor: buildAnchorLabel(input.anchor),
    microActions: [
      firstAction,
      {
        title: input.goal.toLowerCase().includes("write")
          ? "List one idea you could return to later"
          : input.goal.toLowerCase().includes("read")
            ? "Highlight one useful line"
            : `Prepare one thing you need for "${input.goal}"`,
        reason: "Preparation lowers friction for the next attempt.",
        durationMinutes: Math.min(maxDuration, input.difficulty === "hard" ? 1 : 3),
        fallbackAction: failureReason === "too_big" ? "Touch the tool you need" : "Place the tool where you can see it",
      },
      {
        title: input.goal.toLowerCase().includes("write")
          ? "Read yesterday's sentence and add one more"
          : input.goal.toLowerCase().includes("read")
            ? "Set out tomorrow's book"
            : `Leave tomorrow's first step ready for "${input.goal}"`,
        reason: "Restarting gets easier when tomorrow already begins half-done.",
        durationMinutes: Math.min(maxDuration, input.difficulty === "hard" ? 1 : 3),
        fallbackAction: failureReason === "too_big" ? "Look at the tool and stop" : "Move the tool into sight",
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
  options?: { failureReason?: FailureReason },
): Promise<HabitDecomposition> {
  const failureReason = options?.failureReason;

  try {
    const prompt = buildHabitDecompositionPrompt(input, failureReason);
    const payload = await callOpenAI(prompt);
    const text = extractTextFromResponse(payload);
    const parsed = JSON.parse(text) as Omit<HabitDecomposition, "source">;

    return normalizeDecomposition(parsed, input, "openai", failureReason);
  } catch {
    return buildMockHabitDecomposition(input, failureReason);
  }
}

export async function generateMicroActions(input: OnboardingInput): Promise<MicroAction[]> {
  const decomposition = await generateHabitDecomposition(input);
  return decomposition.microActions.map((item) => microActionSchema.parse(item));
}
