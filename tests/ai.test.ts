import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAiOnlyHabitDecompositionPrompt,
  buildHabitDecompositionPrompt,
  buildHybridRewritePrompt,
} from "@/lib/ai/prompt";
import {
  buildMockHabitDecomposition,
  buildRuleBasedHabitDecomposition,
  classifyGoal,
  collectRecentContext,
  detectGoalArchetype,
  generateBehaviorSwarm,
  generateDraftTemplates,
  generateHabitDecomposition,
  generateHabitDecompositionFromSelection,
} from "@/lib/ai";
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
    goal: "글쓰기 습관 만들기",
    availableMinutes: 10,
    difficulty: "hard",
    preferredTime: "morning",
    anchor: "커피 마신 뒤",
  });

  assert.equal(result.microActions.every((action) => action.durationMinutes <= 2), true);
  assert.equal(result.todayAction.durationMinutes <= 2, true);
});

test("too_big failure reason generates a clearly smaller fallback", () => {
  const result = buildMockHabitDecomposition(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "evening",
      anchor: "잠들기 전",
    },
    "too_big",
  );

  assert.match(result.fallbackAction, /펴|열|꺼내|집어/);
  assert.notEqual(result.todayAction.title, result.fallbackAction);
});

test("prompt template includes anti-vague and duration instructions", () => {
  const prompt = buildHabitDecompositionPrompt({
    goal: "Build a reading habit",
    availableMinutes: 5,
    difficulty: "hard",
    preferredTime: "morning",
    anchor: "after coffee",
  });

  assert.match(prompt, /Return JSON only/i);
  assert.match(prompt, /Reject vague phrasing/i);
  assert.match(prompt, /1 to 2 minutes/i);
});

test("ai only prompt keeps the payload short and categorized", () => {
  const prompt = buildAiOnlyHabitDecompositionPrompt(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "커피 마신 뒤",
    },
    {
      archetype: "reading",
      intent: "start",
    },
    undefined,
    "ko",
  );

  assert.match(prompt, /DATA:/);
  assert.match(prompt, /"category":"reading"/);
  assert.match(prompt, /"intent":"start"/);
  assert.doesNotMatch(prompt, /Available minutes:/);
});

test("hybrid rewrite prompt keeps structure constraints", () => {
  const draft = buildMockHabitDecomposition({
    goal: "독서 습관 만들기",
    availableMinutes: 5,
    difficulty: "steady",
    preferredTime: "morning",
    anchor: "커피 마신 뒤",
  });
  const prompt = buildHybridRewritePrompt(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "커피 마신 뒤",
    },
    {
      archetype: "reading",
      intent: "start",
    },
    {
      goalSummary: draft.goalSummary,
      selectedAnchor: draft.selectedAnchor,
      microActions: draft.microActions,
      todayAction: draft.todayAction,
      fallbackAction: draft.fallbackAction,
    },
    undefined,
    "ko",
  );

  assert.match(prompt, /without changing the JSON shape or action count/i);
  assert.match(prompt, /Keep todayAction equal to microActions\[0\]/i);
});

test("goal archetype and intent classification recognize representative goals", () => {
  assert.equal(detectGoalArchetype("독서 습관 만들기"), "reading");
  assert.deepEqual(classifyGoal("아침 일기 쓰기"), { archetype: "writing", intent: "journal" });
  assert.deepEqual(classifyGoal("책상 정리하기"), { archetype: "tidy", intent: "surface" });
});

test("collectRecentContext returns empty context without ids", async () => {
  const context = await collectRecentContext({});

  assert.deepEqual(context.recentStatuses, []);
  assert.equal(context.recentUsedFallbackCount, 0);
});

test("template library expands each archetype to at least five candidates", () => {
  const input = {
    goal: "운동 습관 만들기",
    availableMinutes: 5,
    difficulty: "steady" as const,
    preferredTime: "morning" as const,
    anchor: "퇴근하고 바로",
  };
  const candidates = generateDraftTemplates(
    input,
    {
      archetype: "exercise",
      intent: "mobility",
    },
    {
      recentStatuses: [],
      recentFailureReasons: [],
      recentUsedFallbackCount: 0,
      recentCompletedStreak: 0,
      usedUserLevelPattern: false,
    },
    "ko",
  );

  assert.equal(candidates.length >= 5, true);
  assert.equal(candidates.some((candidate) => candidate.intent === "prepare"), true);
});

test("recent fallback and too_big signals shrink the main action", async () => {
  const result = await buildRuleBasedHabitDecomposition(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 10,
      difficulty: "steady",
      preferredTime: "evening",
      anchor: "커피 마신 뒤",
    },
    {
      recentStatuses: ["failed", "failed"],
      recentFailureReasons: ["too_big"],
      recentUsedFallbackCount: 3,
      recentCompletedStreak: 0,
      usedUserLevelPattern: false,
    },
    {
      locale: "ko",
      failureReason: "too_big",
    },
  );

  assert.match(result.todayAction.title, /펴|꺼내|열/);
  assert.notEqual(result.todayAction.title, result.fallbackAction);
});

test("forgot reason makes anchor-friendly copy more direct", async () => {
  const result = await buildRuleBasedHabitDecomposition(
    {
      goal: "책상 정리하기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "아침 커피 뒤",
    },
    {
      recentStatuses: ["failed"],
      recentFailureReasons: ["forgot"],
      recentUsedFallbackCount: 0,
      recentCompletedStreak: 0,
      usedUserLevelPattern: false,
    },
    {
      locale: "ko",
      failureReason: "forgot",
    },
  );

  assert.match(result.todayAction.reason, /아침 커피 뒤/);
});

test("rules_only strategy returns a rules source without calling AI", async () => {
  const result = await generateHabitDecomposition(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "커피 마신 뒤",
    },
    {
      strategy: "rules_only",
      locale: "ko",
    },
  );

  assert.equal(result.source, "rules");
  assert.equal(result.microActions.length >= 2, true);
});

test("hybrid strategy falls back to rules even when mock fallback is disabled", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";

  try {
    const result = await generateHabitDecomposition(
      {
        goal: "정리 루틴 만들기",
        availableMinutes: 5,
        difficulty: "steady",
        preferredTime: "morning",
        anchor: "가방 내려놓은 뒤",
      },
      {
        strategy: "hybrid",
        locale: "ko",
        allowMockFallback: false,
        failureReason: "too_big",
      },
    );

    assert.equal(result.source, "rules");
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

test("generateBehaviorSwarm returns 6 to 10 concrete candidates", async () => {
  const result = await generateBehaviorSwarm(
    {
      goal: "Build a reading habit",
      desiredOutcome: "Read a little each day.",
      motivationNote: "I want reading to feel normal again.",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
    },
    {
      strategy: "rules_only",
      locale: "en",
    },
  );

  assert.equal(result.length >= 6 && result.length <= 10, true);
  assert.equal(result.every((candidate) => candidate.durationMinutes <= 5), true);
});

test("generateBehaviorSwarm uses the fast GPT-5 settings when OPENAI_MODEL is slower", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFastModel = process.env.OPENAI_MODEL_FAST;
  const originalTimeout = process.env.OPENAI_TIMEOUT_MS;
  const originalFetch = global.fetch;
  const requests: Array<Record<string, unknown>> = [];

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5";
  delete process.env.OPENAI_MODEL_FAST;
  delete process.env.OPENAI_TIMEOUT_MS;

  global.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          candidates: [
            { title: "Read one sentence", details: "Tiny start.", durationMinutes: 1, desireScore: 4, abilityScore: 5, impactScore: 3 },
            { title: "Open the book", details: "Setup only.", durationMinutes: 1, desireScore: 4, abilityScore: 5, impactScore: 3 },
            { title: "Read one line", details: "Visible start.", durationMinutes: 1, desireScore: 4, abilityScore: 5, impactScore: 4 },
            { title: "Put the book on the pillow", details: "Prep for later.", durationMinutes: 1, desireScore: 3, abilityScore: 5, impactScore: 2 },
            { title: "Highlight one line", details: "Keep it easy.", durationMinutes: 1, desireScore: 3, abilityScore: 5, impactScore: 3 },
            { title: "Read one paragraph", details: "Still short.", durationMinutes: 2, desireScore: 4, abilityScore: 4, impactScore: 4 },
          ],
        }),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }) as typeof fetch;

  try {
    const result = await generateBehaviorSwarm(
      {
        goal: "Build a reading habit",
        desiredOutcome: "Read a little each day.",
        motivationNote: "I want reading to feel normal again.",
        availableMinutes: 5,
        difficulty: "steady",
        preferredTime: "morning",
      },
      {
        strategy: "ai_only",
        locale: "en",
      },
    );

    assert.equal(result.length, 6);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.model, "gpt-5-mini");
    assert.deepEqual(requests[0]?.reasoning, { effort: "minimal" });
    assert.equal(requests[0]?.max_output_tokens, 700);
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalModel;
    }

    if (originalFastModel === undefined) {
      delete process.env.OPENAI_MODEL_FAST;
    } else {
      process.env.OPENAI_MODEL_FAST = originalFastModel;
    }

    if (originalTimeout === undefined) {
      delete process.env.OPENAI_TIMEOUT_MS;
    } else {
      process.env.OPENAI_TIMEOUT_MS = originalTimeout;
    }
  }
});

test("generateHabitDecompositionFromSelection keeps the selected behavior first", async () => {
  const result = await generateHabitDecompositionFromSelection(
    {
      goal: "Build a reading habit",
      desiredOutcome: "Read a little each day.",
      motivationNote: "I want reading to feel normal again.",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "after coffee",
      backupAnchors: ["after lunch"],
      selectedBehavior: {
        title: "Open the book and read one page",
        details: "A tiny visible start.",
        durationMinutes: 2,
        desireScore: 4,
        abilityScore: 5,
        impactScore: 4,
      },
      swarmCandidates: [
        {
          title: "Open the book and read one page",
          details: "A tiny visible start.",
          durationMinutes: 2,
          desireScore: 4,
          abilityScore: 5,
          impactScore: 4,
        },
        {
          title: "Read one sentence",
          details: "Even lighter.",
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
          details: "Setup only.",
          durationMinutes: 1,
          desireScore: 3,
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
        {
          title: "Read one paragraph",
          details: "Still short.",
          durationMinutes: 1,
          desireScore: 4,
          abilityScore: 5,
          impactScore: 4,
        },
      ],
      recipeText: "After coffee, I will open the book and read one page.",
      celebrationText: "Nice. I did it.",
      rehearsalCount: 2,
      mode: "create",
    },
    {
      title: "Open the book and read one page",
      details: "A tiny visible start.",
      durationMinutes: 2,
      desireScore: 4,
      abilityScore: 5,
      impactScore: 4,
    },
    {
      strategy: "rules_only",
      locale: "en",
    },
  );

  assert.equal(result.todayAction.title, "Open the book and read one page");
  assert.equal(result.fallbackAction.length > 0, true);
});

test("homepage tone is reflected in the AI prompt", () => {
  const prompt = buildAiOnlyHabitDecompositionPrompt(
    {
      goal: "Build a reading habit",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "after coffee",
    },
    {
      archetype: "reading",
      intent: "start",
    },
    undefined,
    "en",
  );

  assert.match(prompt, /today, one small step is enough/i);
  assert.match(prompt, /smaller than the user's resistance/i);
});

test("rule-based decomposition matches the calmer homepage tone", async () => {
  const result = await buildRuleBasedHabitDecomposition(
    {
      goal: "독서 습관 만들기",
      availableMinutes: 5,
      difficulty: "steady",
      preferredTime: "morning",
      anchor: "커피 마신 뒤",
    },
    undefined,
    {
      locale: "ko",
    },
  );

  assert.equal(result.goalSummary, '오늘은 "독서 습관 만들기" 한 단계만 합니다.');
  assert.equal(result.todayAction.title.includes("한 줄") || result.todayAction.title.includes("펴"), true);
});

test("locale validation accepts Korean strings when locale is ko", () => {
  assert.equal(isLocalizedString("책만 펴고 끝내기", "ko", "독서 습관 만들기"), true);
});

test("locale validation accepts English strings when locale is en", () => {
  assert.equal(isLocalizedString('Open what you need for "Build a reading habit" and stop there', "en", "Build a reading habit"), true);
});

test("locale validation rejects Korean text for English responses", () => {
  assert.equal(isLocalizedString("책 한 문장만 읽기", "en", "Build a reading habit"), false);
});

test("validateDecompositionLocale throws on mixed-locale decomposition", () => {
  assert.throws(() =>
    validateDecompositionLocale(
      {
        goalSummary: "Start with one tiny visible step today.",
        selectedAnchor: "Before bed",
        microActions: [
          {
            title: "책을 펴고 한 페이지 읽기",
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
