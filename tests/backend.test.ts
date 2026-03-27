import test from "node:test";
import assert from "node:assert/strict";

import {
  behaviorSwarmCandidatesSchema,
  failureReasonSchema,
  onboardingRequestSchema,
  planMicroActionsSchema,
} from "@/lib/validators/backend";
import {
  adjustReviewActions,
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

test("onboardingRequestSchema accepts the backend MVP payload", () => {
  const result = onboardingRequestSchema.parse({
    goalTitle: "Build a reading habit",
    goalWhy: "I want reading to feel normal again.",
    desiredOutcome: "Read a little each day.",
    motivationNote: "I want reading to feel normal again.",
    difficulty: "gentle",
    availableMinutes: 5,
    anchorLabel: "After coffee",
    anchorCue: "When the mug is on the desk",
    preferredTime: "morning",
    backupAnchors: ["After lunch"],
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
    recipeText: "커피 마신 뒤 책 한 페이지 읽기",
    celebrationText: "좋아, 했다.",
    rehearsalCount: 3,
  });

  assert.equal(result.goalTitle, "Build a reading habit");
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

test("adjustReviewActions makes the first action easier and keeps a smaller fallback", () => {
  const result = adjustReviewActions(
    [
      {
        position: 1,
        title: "책을 펴고 한 페이지 읽기",
        details: "한 페이지면 바로 시작할 수 있어요.",
        durationMinutes: 2,
        fallbackTitle: "책만 펴고 끝내기",
        fallbackDetails: "더 작은 대체 행동",
        fallbackDurationMinutes: 1,
      },
    ],
    "easier",
    "ko",
  );

  assert.equal(result[0]?.title, "책만 펴고 끝내기");
  assert.equal(result[0]?.durationMinutes, 1);
  assert.notEqual(result[0]?.title, result[0]?.fallbackTitle);
});

test("adjustReviewActions makes the first action bigger without breaking fallback", () => {
  const result = adjustReviewActions(
    [
      {
        position: 1,
        title: "메모 앱만 열기",
        details: "가볍게 시작해요.",
        durationMinutes: 1,
        fallbackTitle: "메모 앱만 보기",
        fallbackDetails: "더 작은 대체 행동",
        fallbackDurationMinutes: 1,
      },
      {
        position: 2,
        title: "메모 앱을 열고 한 문장 쓰기",
        details: "한 문장이면 충분해요.",
        durationMinutes: 2,
        fallbackTitle: "메모 앱만 열기",
        fallbackDetails: "더 작은 대체 행동",
        fallbackDurationMinutes: 1,
      },
    ],
    "harder",
    "ko",
  );

  assert.equal(result[0]?.title, "메모 앱을 열고 한 문장 쓰기");
  assert.equal(result[0]?.durationMinutes, 2);
  assert.equal(result[0]?.fallbackTitle, "메모 앱만 열기");
});

test("adjustReviewActions keeps minimum and maximum bounds", () => {
  const easier = adjustReviewActions(
    [
      {
        position: 1,
        title: "도구 하나만 꺼내기",
        details: "",
        durationMinutes: 1,
        fallbackTitle: "도구 위치만 보기",
        fallbackDetails: "",
        fallbackDurationMinutes: 1,
      },
    ],
    "easier",
    "ko",
  );
  const harder = adjustReviewActions(
    [
      {
        position: 1,
        title: "두 페이지 읽기",
        details: "",
        durationMinutes: 5,
        fallbackTitle: "한 페이지 읽기",
        fallbackDetails: "",
        fallbackDurationMinutes: 4,
      },
    ],
    "harder",
    "ko",
  );

  assert.equal(easier[0]?.durationMinutes, 1);
  assert.equal(harder[0]?.durationMinutes, 5);
});

test("getReviewActionSizeLabel reflects the current action size", () => {
  assert.equal(getReviewActionSizeLabel(1, "ko"), "아주 작게");
  assert.equal(getReviewActionSizeLabel(2, "ko"), "가볍게");
  assert.equal(getReviewActionSizeLabel(4, "ko"), "조금 크게");
});
