"use server";

import { redirect } from "next/navigation";

import { generateHabitDecompositionFromSelection } from "@/lib/ai";
import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { assignDailyAction, createPlanVersion } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { adjustReviewActions, mapGeneratedActionsToPlanInput, prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { planMicroActionsSchema, type PlanMicroActionInput } from "@/lib/validators/backend";
import type { Database } from "@/types";

async function loadReviewActionsForSession(
  client: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  session: Awaited<ReturnType<typeof getHabitSession>>,
): Promise<PlanMicroActionInput[]> {
  if (session.reviewActions?.length) {
    return session.reviewActions;
  }

  if (!session.planId) {
    return [];
  }

  const { data, error } = await client
    .from("micro_actions")
    .select("position, title, details, duration_minutes, fallback_title, fallback_details, fallback_duration_minutes")
    .eq("plan_id", session.planId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const microActions = (data ?? []) as Array<
    Pick<
      Database["public"]["Tables"]["micro_actions"]["Row"],
      "position" | "title" | "details" | "duration_minutes" | "fallback_title" | "fallback_details" | "fallback_duration_minutes"
    >
  >;

  return microActions.map((action) => ({
    position: action.position,
    title: action.title,
    details: action.details ?? "",
    durationMinutes: action.duration_minutes,
    fallbackTitle: action.fallback_title,
    fallbackDetails: action.fallback_details ?? "",
    fallbackDurationMinutes: action.fallback_duration_minutes,
  }));
}

export async function adjustOnboardingReviewAction(direction: "easier" | "harder") {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "온보딩을 먼저 진행해 주세요." : "Complete onboarding first.")}`);
  }

  const client = await getSupabaseServerClient();
  const currentActions = await loadReviewActionsForSession(client, session);
  const adjustedActions = adjustReviewActions(currentActions, direction, locale);

  await setHabitSession({
    ...session,
    userId: user.id,
    reviewActions: adjustedActions,
  });

  redirect(`/onboarding/review?notice=${encodeURIComponent(direction === "easier" ? "더 쉽게 바꿨어요." : "조금 키웠어요.")}`);
}

export async function regenerateOnboardingReviewPlan() {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId || !session.reviewMeta) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "온보딩을 먼저 진행해 주세요." : "Complete onboarding first.")}`);
  }

  const decomposition = await generateHabitDecompositionFromSelection(
    {
      goal: session.reviewMeta.goal,
      desiredOutcome: session.reviewMeta.desiredOutcome,
      motivationNote: session.reviewMeta.motivationNote ?? "",
      availableMinutes: session.reviewMeta.availableMinutes,
      difficulty: session.reviewDifficulty ?? "steady",
      preferredTime: session.reviewMeta.preferredTime,
      anchor: session.reviewMeta.primaryAnchor,
      backupAnchors: session.reviewMeta.backupAnchors,
      selectedBehavior: session.reviewMeta.selectedBehavior,
      swarmCandidates: session.reviewMeta.swarmCandidates,
      recipeText: session.reviewMeta.recipeText,
      celebrationText: session.reviewMeta.celebrationText,
      rehearsalCount: session.reviewMeta.rehearsalCount,
      mode: "create",
    },
    session.reviewMeta.selectedBehavior,
    {
      locale,
      userId: user.id,
      goalId: session.goalId,
      basedOnPlanId: session.planId,
    },
  );

  await setHabitSession({
    ...session,
    userId: user.id,
    reviewActions: mapGeneratedActionsToPlanInput(decomposition.microActions),
  });

  redirect(`/onboarding/review?notice=${encodeURIComponent("다시 만들었어요.")}`);
}

export async function finalizeOnboardingReview(formData: FormData) {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId || !session.planId || !session.reviewMeta) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "온보딩을 먼저 진행해 주세요." : "Complete onboarding first.")}`);
  }

  const rawActions = String(formData.get("actionsJson") ?? "[]");
  const selectedPosition = Number(formData.get("selectedPosition") ?? 1);

  let parsedActions: PlanMicroActionInput[];

  try {
    parsedActions = planMicroActionsSchema.parse(JSON.parse(rawActions));
  } catch {
    redirect(`/onboarding/review?error=${encodeURIComponent(locale === "ko" ? "행동 정보를 읽지 못했어요." : "We could not read the edited actions.")}`);
  }

  const prioritizedActions = prioritizeSelectedMicroAction(parsedActions, selectedPosition);
  const client = await getSupabaseServerClient();
  const planResult = (await createPlanVersion(client, {
    userId: user.id,
    goalId: session.goalId,
    source: "manual",
    basedOnPlanId: session.planId,
    notes: "온보딩 검토 후 확정",
    recipeText: session.reviewMeta.recipeText,
    celebrationText: session.reviewMeta.celebrationText,
    rehearsalCount: session.reviewMeta.rehearsalCount,
    selectedCandidateId: session.reviewMeta.selectedCandidateId ?? null,
    microActions: prioritizedActions,
  })) as {
    plan: { id: string };
    micro_actions: Array<{ id: string; position: number }>;
  };

  const selectedMicroAction = planResult.micro_actions.find((action) => action.position === 1);

  if (!selectedMicroAction) {
    redirect(`/onboarding/review?error=${encodeURIComponent(locale === "ko" ? "오늘 행동을 고르지 못했어요." : "We could not choose today's action.")}`);
  }

  const dailyAction = (await assignDailyAction(client, {
    userId: user.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroAction.id,
    actionDate: new Date().toISOString().slice(0, 10),
  })) as { id: string };

  await setHabitSession({
    ...session,
    userId: user.id,
    planId: planResult.plan.id,
    microActionId: selectedMicroAction.id,
    dailyActionId: dailyAction.id,
    reviewActions: undefined,
    reviewDifficulty: undefined,
  });

  redirect("/today");
}
