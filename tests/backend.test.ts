import test from "node:test";
import assert from "node:assert/strict";

import { onboardingRequestSchema, planMicroActionsSchema } from "@/lib/schemas/backend";
import { buildRecoveryPreview, mapGeneratedActionsToPlanInput } from "@/lib/server/habit-rules";

test("planMicroActionsSchema rejects duplicate positions", () => {
  const result = planMicroActionsSchema.safeParse([
    {
      position: 1,
      title: "Read one page",
      durationMinutes: 2,
      fallbackTitle: "Read one sentence",
      fallbackDurationMinutes: 1,
    },
    {
      position: 1,
      title: "Highlight one line",
      durationMinutes: 2,
      fallbackTitle: "Touch the book",
      fallbackDurationMinutes: 1,
    },
  ]);

  assert.equal(result.success, false);
});

test("mapGeneratedActionsToPlanInput preserves fallback requirements", () => {
  const result = mapGeneratedActionsToPlanInput([
    {
      title: "Read one page",
      reason: "Tiny and observable.",
      durationMinutes: 2,
      fallbackAction: "Read one sentence",
    },
  ]);

  assert.equal(result[0]?.fallbackTitle, "Read one sentence");
  assert.equal(result[0]?.fallbackDurationMinutes, 1);
  assert.equal(result[0]?.position, 1);
});

test("buildRecoveryPreview shrinks only the selected action", () => {
  const result = buildRecoveryPreview(
    [
      {
        position: 1,
        title: "Read one page",
        details: "Open the book.",
        durationMinutes: 2,
        fallbackTitle: "Read one sentence",
        fallbackDetails: null,
        fallbackDurationMinutes: 1,
      },
      {
        position: 2,
        title: "Highlight one line",
        details: "Mark the most useful line.",
        durationMinutes: 2,
        fallbackTitle: "Touch the book",
        fallbackDetails: null,
        fallbackDurationMinutes: 1,
      },
    ],
    1,
  );

  assert.equal(result[0]?.title, "Smaller step: Read one page");
  assert.equal(result[0]?.durationMinutes, 1);
  assert.equal(result[1]?.title, "Highlight one line");
});

test("onboardingRequestSchema accepts the backend MVP payload", () => {
  const result = onboardingRequestSchema.parse({
    userId: "11111111-1111-1111-1111-111111111111",
    goalTitle: "Build a reading habit",
    goalWhy: "I want reading to feel normal again.",
    difficulty: "gentle",
    availableMinutes: 5,
    anchorLabel: "After coffee",
    anchorCue: "When the mug is on the desk",
    preferredTime: "morning",
  });

  assert.equal(result.goalTitle, "Build a reading habit");
});
