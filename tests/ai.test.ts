import test from "node:test";
import assert from "node:assert/strict";

import { buildHabitDecompositionPrompt } from "@/lib/ai/prompt";
import { buildMockHabitDecomposition } from "@/lib/ai";
import { isLocalizedString, validateDecompositionLocale } from "@/lib/ai/locale-validation";
import { microActionSchema } from "@/lib/validators/habit";

test("microActionSchema rejects vague action text", () => {
  const result = microActionSchema.safeParse({
    title: "Do your best on reading",
    reason: "Try to move forward.",
    durationMinutes: 3,
    fallbackAction: "Make progress if you can",
  });

  assert.equal(result.success, false);
});

test("hard difficulty mock decomposition keeps actions extra small", () => {
  const result = buildMockHabitDecomposition({
    goal: "Build a writing habit",
    availableMinutes: 10,
    difficulty: "hard",
    preferredTime: "morning",
    anchor: "after-coffee",
  });

  assert.equal(result.microActions.every((action) => action.durationMinutes <= 2), true);
  assert.equal(result.todayAction.durationMinutes <= 2, true);
});

test('too_big failure reason generates smaller fallback copy', () => {
  const result = buildMockHabitDecomposition(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "evening",
      anchor: "before-bed",
    },
    "too_big",
  );

  assert.match(result.fallbackAction, /열고|만지|보기/);
});

test("prompt template includes anti-vague and duration instructions", () => {
  const prompt = buildHabitDecompositionPrompt({
    goal: "Build a reading habit",
    availableMinutes: 5,
    difficulty: "hard",
    preferredTime: "morning",
    anchor: "after-coffee",
  });

  assert.match(prompt, /Return JSON only/i);
  assert.match(prompt, /Reject vague phrasing/i);
  assert.match(prompt, /1 to 2 minutes/i);
});

test("locale validation accepts Korean strings when locale is ko", () => {
  assert.equal(isLocalizedString('"' + "독서 습관 만들기" + '"에 필요한 것을 열고 멈추기', "ko", "독서 습관 만들기"), true);
});

test("locale validation accepts English strings when locale is en", () => {
  assert.equal(isLocalizedString('Open what you need for "독서 습관 만들기" and stop there', "en", "독서 습관 만들기"), true);
});

test("locale validation rejects Korean text for English responses", () => {
  assert.equal(isLocalizedString("한 문장만 읽기", "en", "Build a reading habit"), false);
});

test("validateDecompositionLocale throws on mixed-locale decomposition", () => {
  assert.throws(() =>
    validateDecompositionLocale(
      {
        goalSummary: "Start with one tiny visible step today.",
        selectedAnchor: "Before bed",
        microActions: [
          {
            title: "책을 펴고 한 페이지만 읽기",
            reason: "A visible step is easier to begin.",
            durationMinutes: 1,
            fallbackAction: 'Open what you need for "Build a reading habit" and stop there',
          },
        ],
        todayAction: {
          title: "Open your book and read one page",
          reason: "A visible step is easier to begin.",
          durationMinutes: 1,
          fallbackAction: 'Open what you need for "Build a reading habit" and stop there',
        },
        fallbackAction: 'Open what you need for "Build a reading habit" and stop there',
      },
      { goal: "Build a reading habit" },
      "en",
    ),
  );
});
