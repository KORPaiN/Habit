import test from "node:test";
import assert from "node:assert/strict";

import {
  behaviorSwarmCandidatesSchema,
  failureReasonSchema,
  onboardingRequestSchema,
  planMicroActionsSchema,
} from "@/lib/validators/backend";
import {
  buildRecoveryPreview,
  getReviewActionSizeLabel,
  mapGeneratedActionsToPlanInput,
  prioritizeSelectedMicroAction,
} from "@/lib/utils/habit-rules";

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

  assert.equal(result[0]?.title, "더 작은 단계: Read one page");
  assert.equal(result[0]?.durationMinutes, 1);
  assert.equal(result[1]?.title, "Highlight one line");
});

test("onboardingRequestSchema accepts the simplified backend payload", () => {
  const result = onboardingRequestSchema.parse({
    goalTitle: "Build a reading habit",
    goalWhy: null,
    desiredOutcome: "Read a little each day.",
    anchorLabel: "After coffee",
    anchorCue: "After coffee",
    selectedBehavior: {
      title: "Open the book and read one page",
      details: "A tiny step.",
      durationMinutes: 2,
      desireScore: 4,
      abilityScore: 5,
      impactScore: 4,
    },
    swarmCandidates: [
      {
        title: "Open the book and read one page",
        details: "A tiny step.",
        durationMinutes: 2,
        desireScore: 4,
        abilityScore: 5,
        impactScore: 4,
      },
      {
        title: "Read one paragraph",
        details: "Very short.",
        durationMinutes: 1,
        desireScore: 4,
        abilityScore: 5,
        impactScore: 3,
      },
      {
        title: "Highlight one line",
        details: "Keep it visible.",
        durationMinutes: 1,
        desireScore: 3,
        abilityScore: 5,
        impactScore: 4,
      },
      {
        title: "Open the book",
        details: "Start with setup.",
        durationMinutes: 1,
        desireScore: 3,
        abilityScore: 5,
        impactScore: 3,
      },
      {
        title: "Read one sentence",
        details: "Even smaller.",
        durationMinutes: 1,
        desireScore: 4,
        abilityScore: 5,
        impactScore: 3,
      },
      {
        title: "Put the book on the desk",
        details: "Prep for later.",
        durationMinutes: 1,
        desireScore: 3,
        abilityScore: 5,
        impactScore: 3,
      },
    ],
    recipeText: "After coffee, I will open the book and read one page.",
    celebrationText: "좋아, 됐어.",
    rehearsalCount: 0,
  });

  assert.equal(result.goalTitle, "Build a reading habit");
  assert.equal(result.difficulty, "gentle");
});

test("behaviorSwarmCandidatesSchema requires 6 to 10 candidates", () => {
  const result = behaviorSwarmCandidatesSchema.safeParse([
    {
      title: "Read one page",
      details: "Small.",
      durationMinutes: 2,
      desireScore: 4,
      abilityScore: 5,
      impactScore: 4,
    },
  ]);

  assert.equal(result.success, false);
});

test("failureReasonSchema accepts the new recovery reasons", () => {
  assert.equal(failureReasonSchema.parse("forgot_often"), "forgot_often");
  assert.equal(failureReasonSchema.parse("not_wanted"), "not_wanted");
});

test("prioritizeSelectedMicroAction moves the chosen action to position one", () => {
  const result = prioritizeSelectedMicroAction(
    [
      {
        position: 1,
        title: "Read one page",
        details: null,
        durationMinutes: 2,
        fallbackTitle: "Read one sentence",
        fallbackDetails: null,
        fallbackDurationMinutes: 1,
      },
      {
        position: 2,
        title: "Highlight one line",
        details: null,
        durationMinutes: 2,
        fallbackTitle: "Touch the book",
        fallbackDetails: null,
        fallbackDurationMinutes: 1,
      },
    ],
    2,
  );

  assert.equal(result[0]?.title, "Highlight one line");
  assert.equal(result[0]?.position, 1);
  assert.equal(result[1]?.position, 2);
});

test("getReviewActionSizeLabel reflects the current action size", () => {
  assert.equal(getReviewActionSizeLabel(1, "ko"), "아주 작게");
  assert.equal(getReviewActionSizeLabel(2, "ko"), "가볍게");
  assert.equal(getReviewActionSizeLabel(4, "ko"), "조금 크게");
});
