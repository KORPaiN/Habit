import test from "node:test";
import assert from "node:assert/strict";

import { buildHabitDecompositionPrompt } from "@/lib/prompts/habit-decomposition";
import { buildMockHabitDecomposition } from "@/lib/services/ai";
import { microActionSchema } from "@/lib/schemas/habit";

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
      goal: "Build a reading habit",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "evening",
      anchor: "before-bed",
    },
    "too_big",
  );

  assert.match(result.fallbackAction, /open|touch|look/i);
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
