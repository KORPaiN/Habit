"use server";

import { generateHabitDecompositionFromSelection } from "@/lib/ai";
import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getRecoveryContextFromSession } from "@/lib/supabase/demo-data";
import { assignDailyAction, createPlanVersion, failDailyAction, reselectGoalPlan } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { mapGeneratedActionsToPlanInput, prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { failureReasonSchema } from "@/lib/validators/backend";
import { microActionSchema } from "@/lib/validators/habit";

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

export async function prepareRecoveryOptions(input: { failureReason: RecoveryReason }): Promise<RecoveryPreparationResult> {
  const locale = await getLocale();
  const rawReason = failureReasonSchema.parse(input.failureReason);
  const reason = normalizeRecoveryReason(rawReason);
  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    throw new Error(locale === "ko" ? "로그인 후 이용해 주세요." : "Please sign in with Google first.");
  }

  const context = await getRecoveryContextFromSession(session);
  const reviewMeta = session.reviewMeta;

  if (!context || !reviewMeta) {
    throw new Error(locale === "ko" ? "먼저 계획을 만들어 주세요." : "Create a plan before opening recovery.");
  }

  let savedFailure = false;

  if (canUseSupabase() && session.dailyActionId) {
    try {
      await failDailyAction(await getSupabaseServerClient(), session.dailyActionId, {
        userId: authenticatedUser.id,
        failureReason: rawReason,
        notes: "복구 분기 진입",
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
          reason: "지금 맞는 행동으로 다시 고릅니다.",
        },
      ],
    };
  }

  if (reason === "forgot" || reason === "forgot_often") {
    const anchorCandidates = [
      reviewMeta.primaryAnchor,
      ...reviewMeta.backupAnchors,
      ...(reason === "forgot_often" ? ["집에 들어온 뒤", "양치한 뒤"] : []),
    ].filter((cue, index, list) => cue && list.indexOf(cue) === index);

    return {
      reason,
      savedFailure,
      options: anchorCandidates.slice(0, 3).map((cue, index) => ({
        id: `anchor-${index + 1}`,
        mode: "anchor_shift",
        title: cue,
        reason: reason === "forgot" ? "더 눈에 띄는 앵커로 붙입니다." : "백업 앵커로 바꾸고 다시 리허설합니다.",
        anchorCue: cue,
      })),
    };
  }

  const decomposition = await generateHabitDecompositionFromSelection(
    {
      goal: reviewMeta.goal,
      desiredOutcome: reviewMeta.desiredOutcome,
      motivationNote: reviewMeta.motivationNote ?? "",
      availableMinutes: reviewMeta.availableMinutes,
      difficulty: reviewMeta.difficulty,
      preferredTime: reviewMeta.preferredTime,
      anchor: reviewMeta.primaryAnchor,
      backupAnchors: reviewMeta.backupAnchors,
      selectedBehavior: reviewMeta.selectedBehavior,
      swarmCandidates: reviewMeta.swarmCandidates,
      recipeText: reviewMeta.recipeText,
      celebrationText: reviewMeta.celebrationText,
      rehearsalCount: reviewMeta.rehearsalCount,
      mode: "create",
    },
    reviewMeta.selectedBehavior,
    {
      failureReason: "too_big",
      locale,
      strategy: "ai_only",
      modelPreference: "fast",
      userId: authenticatedUser.id,
      goalId: session.goalId ?? undefined,
      basedOnPlanId: session.planId ?? undefined,
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
  const reason = normalizeRecoveryReason(failureReasonSchema.parse(input.failureReason));
  const selectedOption = input.options.find((option) => option.id === input.selectedId) ?? input.options[0];
  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();

  if (!selectedOption) {
    throw new Error("복구 옵션을 찾지 못했어요.");
  }

  if (!authenticatedUser || !session.goalId || !session.planId || !session.reviewMeta) {
    throw new Error("로그인 정보가 필요합니다.");
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
    const nextBackupAnchors = [session.reviewMeta.primaryAnchor, ...session.reviewMeta.backupAnchors]
      .filter((cue, index, list) => cue !== nextPrimaryAnchor && list.indexOf(cue) === index)
      .slice(0, 2);

    const result = await reselectGoalPlan(client, {
      userId: authenticatedUser.id,
      goalId: session.goalId,
      basedOnPlanId: session.planId,
      goalTitle: session.reviewMeta.goal,
      goalWhy: session.reviewMeta.motivationNote ?? null,
      desiredOutcome: session.reviewMeta.desiredOutcome,
      motivationNote: session.reviewMeta.motivationNote ?? null,
      difficulty: session.reviewMeta.difficulty,
      availableMinutes: session.reviewMeta.availableMinutes,
      anchorLabel: nextPrimaryAnchor,
      anchorCue: nextPrimaryAnchor,
      preferredTime: session.reviewMeta.preferredTime,
      backupAnchors: nextBackupAnchors,
      selectedBehavior: session.reviewMeta.selectedBehavior,
      swarmCandidates: session.reviewMeta.swarmCandidates,
      recipeText: session.reviewMeta.recipeText.replace(session.reviewMeta.primaryAnchor, nextPrimaryAnchor),
      celebrationText: session.reviewMeta.celebrationText,
      rehearsalCount: reason === "forgot_often" ? 0 : session.reviewMeta.rehearsalCount,
      locale: "ko",
    });

    const selectedMicroAction = (result.initialPlan as { micro_actions: Array<{ id: string; position: number }>; plan: { id: string } }).micro_actions.find(
      (item) => item.position === 1,
    );

    if (!selectedMicroAction) {
      throw new Error("새 행동을 고르지 못했어요.");
    }

    const dailyAction = (await assignDailyAction(client, {
      userId: authenticatedUser.id,
      goalId: session.goalId,
      planId: (result.initialPlan as { plan: { id: string } }).plan.id,
      microActionId: selectedMicroAction.id,
      actionDate: new Date().toISOString().slice(0, 10),
    })) as { id: string };

    await setHabitSession({
      ...session,
      userId: authenticatedUser.id,
      planId: (result.initialPlan as { plan: { id: string } }).plan.id,
      microActionId: selectedMicroAction.id,
      dailyActionId: dailyAction.id,
      reviewMeta: {
        ...session.reviewMeta,
        primaryAnchor: nextPrimaryAnchor,
        backupAnchors: nextBackupAnchors,
        recipeText: session.reviewMeta.recipeText.replace(session.reviewMeta.primaryAnchor, nextPrimaryAnchor),
        rehearsalCount: reason === "forgot_often" ? 0 : session.reviewMeta.rehearsalCount,
      },
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
      fallbackTitle: option.fallbackAction ?? "준비물 꺼내기",
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
    basedOnPlanId: session.planId,
    notes: "복구 후 더 작은 행동",
    recipeText: session.reviewMeta.recipeText,
    celebrationText: session.reviewMeta.celebrationText,
    rehearsalCount: session.reviewMeta.rehearsalCount,
    selectedCandidateId: session.reviewMeta.selectedCandidateId ?? null,
    microActions: prioritizedActions,
  })) as {
    plan: { id: string };
    micro_actions: Array<{ id: string; position: number }>;
  };

  const selectedMicroActionId = planResult.micro_actions.find((item) => item.position === 1)?.id;

  if (!selectedMicroActionId) {
    throw new Error("복구 행동을 저장하지 못했어요.");
  }

  const dailyAction = (await assignDailyAction(client, {
    userId: authenticatedUser.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroActionId,
    actionDate: new Date().toISOString().slice(0, 10),
  })) as { id: string };

  await setHabitSession({
    ...session,
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
  const context = await getRecoveryContextFromSession(session);

  if (!context) {
    return null;
  }

  return {
    currentAction: context.currentAction,
    goal: context.goal,
    reviewMeta: session.reviewMeta,
  };
}
