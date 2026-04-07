"use server";

import { generateHabitDecompositionFromSelection } from "@/lib/ai";
import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getHabitReviewStateFromSession, getRecoveryContextFromSession } from "@/lib/supabase/demo-data";
import { assignDailyAction, createPlanVersion, failDailyAction, getUserAnchors, reselectGoalPlan } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { DEFAULT_AVAILABLE_MINUTES, DEFAULT_DIFFICULTY, DEFAULT_PREFERRED_TIME, microActionSchema } from "@/lib/validators/habit";
import { failureReasonSchema } from "@/lib/validators/backend";

type RecoveryReason = "forgot" | "too_big" | "forgot_often" | "not_wanted";

export type RecoveryOption = {
  id: string;
  mode: "smaller_action" | "anchor_shift" | "reselect";
  title: string;
  reason: string;
  durationMinutes?: number;
  fallbackAction?: string;
  anchorCue?: string;
};

export type RecoveryPreparationResult = {
  reason: RecoveryReason;
  options: RecoveryOption[];
  savedFailure: boolean;
};

function canUseSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeRecoveryReason(reason: string): RecoveryReason {
  if (reason === "too_big") return "too_big";
  if (reason === "forgot_often") return "forgot_often";
  if (reason === "not_wanted") return "not_wanted";
  return "forgot";
}

function dedupeCues(cues: string[]) {
  return cues.filter((cue, index, list) => cue && list.indexOf(cue) === index);
}

export async function prepareRecoveryOptions(input: { failureReason: RecoveryReason }): Promise<RecoveryPreparationResult> {
  const locale = await getLocale();
  const rawReason = failureReasonSchema.parse(input.failureReason);
  const reason = normalizeRecoveryReason(rawReason);
  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    throw new Error(locale === "ko" ? "로그인 후 이용해주세요." : "Please sign in with Google first.");
  }

  const [context, reviewState] = await Promise.all([getRecoveryContextFromSession(session), getHabitReviewStateFromSession(session)]);

  if (!context || !reviewState) {
    throw new Error(locale === "ko" ? "먼저 계획을 만들어주세요." : "Create a plan before opening recovery.");
  }

  let savedFailure = false;

  if (canUseSupabase() && session.dailyActionId) {
    try {
      await failDailyAction(await getSupabaseServerClient(), session.dailyActionId, {
        userId: authenticatedUser.id,
        failureReason: rawReason,
        notes: "리커버리 분기 진입",
        createRecoveryPlan: false,
      });
      savedFailure = true;
    } catch {
      savedFailure = false;
    }
  }

  if (reason === "not_wanted") {
    return {
      reason,
      savedFailure,
      options: [
        {
          id: "reselect",
          mode: "reselect",
          title: "행동 다시 고르기",
          reason: "지금 맞는 행동으로 다시 골라요.",
        },
      ],
    };
  }

  if (reason === "forgot" || reason === "forgot_often") {
    const client = await getSupabaseServerClient();
    const savedAnchors = await getUserAnchors(client, authenticatedUser.id);
    const anchorCandidates = dedupeCues([
      ...savedAnchors.map((anchor: { cue: string }) => anchor.cue),
      "커피 마신 뒤",
      "양치 뒤",
      "집에 들어오면",
    ]).filter((cue) => cue !== reviewState.meta.primaryAnchor);
    const fallbackCandidates = anchorCandidates.length > 0 ? anchorCandidates : [reviewState.meta.primaryAnchor];

    return {
      reason,
      savedFailure,
      options: fallbackCandidates.slice(0, 3).map((cue, index) => ({
        id: `anchor-${index + 1}`,
        mode: "anchor_shift",
        title: cue,
        reason: reason === "forgot" ? "눈에 더 잘 들어오는 루틴으로 붙여요." : "붙일 루틴을 바꿔서 다시 붙여요.",
        anchorCue: cue,
      })),
    };
  }

  const decomposition = await generateHabitDecompositionFromSelection(
    {
      goal: reviewState.meta.goal,
      desiredOutcome: reviewState.meta.desiredOutcome,
      availableMinutes: DEFAULT_AVAILABLE_MINUTES,
      difficulty: DEFAULT_DIFFICULTY,
      preferredTime: DEFAULT_PREFERRED_TIME,
      anchor: reviewState.meta.primaryAnchor,
      selectedBehavior: reviewState.meta.selectedBehavior,
      swarmCandidates: reviewState.meta.swarmCandidates,
      recipeText: reviewState.meta.recipeText,
      celebrationText: reviewState.meta.celebrationText,
      mode: "create",
    },
    reviewState.meta.selectedBehavior,
    {
      failureReason: "too_big",
      locale,
      strategy: "ai_only",
      modelPreference: "fast",
      userId: authenticatedUser.id,
      goalId: session.goalId ?? undefined,
      basedOnPlanId: reviewState.planId,
    },
  );

  const options = decomposition.microActions.map((action, index) => ({
    id: `action-${index + 1}`,
    mode: "smaller_action" as const,
    title: microActionSchema.parse(action).title,
    reason: action.reason,
    durationMinutes: action.durationMinutes,
    fallbackAction: action.fallbackAction,
  }));

  return {
    reason,
    options,
    savedFailure,
  };
}

export async function saveRecoveryChoice(input: {
  failureReason: RecoveryReason;
  selectedId: string;
  options: RecoveryOption[];
}): Promise<{
  selectedAction?: RecoveryOption;
  redirectPath?: string;
  savedSelection: boolean;
}> {
  const selectedOption = input.options.find((option) => option.id === input.selectedId) ?? input.options[0];
  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();
  const reviewState = await getHabitReviewStateFromSession(session);

  if (!selectedOption) {
    throw new Error("리커버리 옵션을 찾지 못했어요.");
  }

  if (!authenticatedUser || !session.goalId || !reviewState) {
    throw new Error("로그인 정보가 필요해요.");
  }

  if (selectedOption.mode === "reselect") {
    return {
      redirectPath: "/onboarding?reselect=1",
      savedSelection: true,
    };
  }

  const client = await getSupabaseServerClient();

  if (selectedOption.mode === "anchor_shift" && selectedOption.anchorCue) {
    const nextPrimaryAnchor = selectedOption.anchorCue;
    const result = await reselectGoalPlan(client, {
      userId: authenticatedUser.id,
      goalId: session.goalId,
      basedOnPlanId: reviewState.planId,
      goalTitle: reviewState.meta.goal,
      goalWhy: null,
      desiredOutcome: reviewState.meta.desiredOutcome,
      difficulty: DEFAULT_DIFFICULTY,
      availableMinutes: DEFAULT_AVAILABLE_MINUTES,
      anchorLabel: nextPrimaryAnchor,
      anchorCue: nextPrimaryAnchor,
      preferredTime: DEFAULT_PREFERRED_TIME,
      selectedBehavior: reviewState.meta.selectedBehavior,
      swarmCandidates: reviewState.meta.swarmCandidates,
      recipeText: reviewState.meta.recipeText.replace(reviewState.meta.primaryAnchor, nextPrimaryAnchor),
      celebrationText: reviewState.meta.celebrationText,
      rehearsalCount: 0,
      locale: "ko",
    });

    const selectedMicroAction = (result.initialPlan as { micro_actions: Array<{ id: string; position: number }>; plan: { id: string } }).micro_actions.find(
      (item) => item.position === 1,
    );

    if (!selectedMicroAction) {
      throw new Error("오늘 행동을 고르지 못했어요.");
    }

    const dailyAction = (await assignDailyAction(client, {
      userId: authenticatedUser.id,
      goalId: session.goalId,
      planId: (result.initialPlan as { plan: { id: string } }).plan.id,
      microActionId: selectedMicroAction.id,
      actionDate: new Date().toISOString().slice(0, 10),
    })) as { id: string };

    await setHabitSession({
      userId: authenticatedUser.id,
      goalId: session.goalId,
      planId: (result.initialPlan as { plan: { id: string } }).plan.id,
      microActionId: selectedMicroAction.id,
      dailyActionId: dailyAction.id,
    });

    return {
      selectedAction: selectedOption,
      savedSelection: true,
    };
  }

  const smallerOptions = input.options
    .filter((option) => option.mode === "smaller_action")
    .map((option, index) => ({
      position: index + 1,
      title: option.title,
      details: option.reason,
      durationMinutes: option.durationMinutes ?? 1,
      fallbackTitle: option.fallbackAction ?? "더 작은 대체 행동",
      fallbackDetails: "더 작은 대체 행동",
      fallbackDurationMinutes: 1,
    }));

  const prioritizedActions = prioritizeSelectedMicroAction(
    smallerOptions,
    smallerOptions.find((option) => option.title === selectedOption.title)?.position ?? 1,
  );
  const planResult = (await createPlanVersion(client, {
    userId: authenticatedUser.id,
    goalId: session.goalId,
    source: "recovery",
    basedOnPlanId: reviewState.planId,
    notes: "리커버리에서 더 작은 행동 선택",
    recipeText: reviewState.meta.recipeText,
    celebrationText: reviewState.meta.celebrationText,
    rehearsalCount: 0,
    selectedCandidateId: reviewState.meta.selectedCandidateId ?? null,
    microActions: prioritizedActions,
  })) as {
    plan: { id: string };
    micro_actions: Array<{ id: string; position: number }>;
  };

  const selectedMicroActionId = planResult.micro_actions.find((item) => item.position === 1)?.id;

  if (!selectedMicroActionId) {
    throw new Error("리커버리 행동을 저장하지 못했어요.");
  }

  const dailyAction = (await assignDailyAction(client, {
    userId: authenticatedUser.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroActionId,
    actionDate: new Date().toISOString().slice(0, 10),
  })) as { id: string };

  await setHabitSession({
    userId: authenticatedUser.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroActionId,
    dailyActionId: dailyAction.id,
  });

  return {
    selectedAction: selectedOption,
    savedSelection: true,
  };
}

export async function getRecoveryPageState() {
  const session = await getHabitSession();
  const [context, reviewState] = await Promise.all([getRecoveryContextFromSession(session), getHabitReviewStateFromSession(session)]);

  if (!context) {
    return null;
  }

  return {
    currentAction: context.currentAction,
    goal: context.goal,
    reviewMeta: reviewState?.meta,
  };
}
