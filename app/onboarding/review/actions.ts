"use server";

import { redirect } from "next/navigation";

import { generateHabitDecompositionFromSelection } from "@/lib/ai";
import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getHabitReviewStateFromSession } from "@/lib/supabase/demo-data";
import { assignDailyAction, createPlanVersion } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { mapGeneratedActionsToPlanInput, prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { DEFAULT_AVAILABLE_MINUTES, DEFAULT_DIFFICULTY, DEFAULT_PREFERRED_TIME } from "@/lib/validators/habit";
import { planMicroActionsSchema, type PlanMicroActionInput } from "@/lib/validators/backend";

function reviewRedirect(params?: { notice?: string; error?: string }) {
  const search = new URLSearchParams({ review: "1" });

  if (params?.notice) {
    search.set("notice", params.notice);
  }

  if (params?.error) {
    search.set("error", params.error);
  }

  redirect(`/onboarding?${search.toString()}`);
}

export async function regenerateOnboardingReviewPlan() {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "먼저 온보딩을 진행해주세요." : "Complete onboarding first.")}`);
  }

  const reviewState = await getHabitReviewStateFromSession(session);

  if (!reviewState) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "검토할 계획을 찾지 못했어요." : "We could not find your review plan.")}`);
  }

  const { meta, planId } = reviewState;
  const decomposition = await generateHabitDecompositionFromSelection(
    {
      goal: meta.goal,
      desiredOutcome: meta.desiredOutcome,
      availableMinutes: DEFAULT_AVAILABLE_MINUTES,
      difficulty: DEFAULT_DIFFICULTY,
      preferredTime: DEFAULT_PREFERRED_TIME,
      anchor: meta.primaryAnchor,
      selectedBehavior: meta.selectedBehavior,
      swarmCandidates: meta.swarmCandidates,
      recipeText: meta.recipeText,
      celebrationText: meta.celebrationText,
      mode: "create",
    },
    meta.selectedBehavior,
    {
      locale,
      strategy: "ai_only",
      modelPreference: "fast",
      userId: user.id,
      goalId: session.goalId,
      basedOnPlanId: planId,
    },
  );

  await setHabitSession({
    ...session,
    userId: user.id,
    planId,
    reviewActions: mapGeneratedActionsToPlanInput(decomposition.microActions),
  });

  reviewRedirect({ notice: locale === "ko" ? "다시 만들었어요." : "Regenerated." });
}

export async function finalizeOnboardingReview(formData: FormData) {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "먼저 온보딩을 진행해주세요." : "Complete onboarding first.")}`);
  }

  const reviewState = await getHabitReviewStateFromSession(session);

  if (!reviewState) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "검토할 계획을 찾지 못했어요." : "We could not find your review plan.")}`);
  }

  const rawActions = String(formData.get("actionsJson") ?? "[]");
  const selectedPosition = Number(formData.get("selectedPosition") ?? 1);

  let parsedActions: PlanMicroActionInput[] = [];

  try {
    parsedActions = planMicroActionsSchema.parse(JSON.parse(rawActions));
  } catch {
    reviewRedirect({ error: locale === "ko" ? "선택한 행동을 읽지 못했어요." : "We could not read the selected action." });
  }

  const prioritizedActions = prioritizeSelectedMicroAction(parsedActions, selectedPosition);
  const client = await getSupabaseServerClient();
  const planResult = (await createPlanVersion(client, {
    userId: user.id,
    goalId: session.goalId,
    source: "manual",
    basedOnPlanId: reviewState.planId,
    notes: "온보딩 마지막 확인",
    recipeText: reviewState.meta.recipeText,
    celebrationText: reviewState.meta.celebrationText,
    rehearsalCount: 0,
    selectedCandidateId: reviewState.meta.selectedCandidateId ?? null,
    microActions: prioritizedActions,
  })) as {
    plan: { id: string };
    micro_actions: Array<{ id: string; position: number }>;
  };

  const selectedMicroAction = planResult.micro_actions.find((action) => action.position === 1);

  if (!selectedMicroAction) {
    reviewRedirect({ error: locale === "ko" ? "오늘 행동을 고르지 못했어요." : "We could not choose today's action." });
  }

  const selectedMicroActionId = selectedMicroAction?.id ?? "";

  if (!selectedMicroActionId) {
    reviewRedirect({ error: locale === "ko" ? "오늘 행동을 고르지 못했어요." : "We could not choose today's action." });
  }

  const dailyAction = (await assignDailyAction(client, {
    userId: user.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroActionId,
    actionDate: new Date().toISOString().slice(0, 10),
  })) as { id: string };

  await setHabitSession({
    userId: user.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroActionId,
    dailyActionId: dailyAction.id,
  });

  redirect("/today");
}
