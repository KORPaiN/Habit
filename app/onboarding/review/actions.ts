"use server";

import { redirect } from "next/navigation";

import { generateHabitDecomposition } from "@/lib/ai";
import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { assignDailyAction, createPlanVersion } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  adjustReviewActions,
  mapGeneratedActionsToPlanInput,
  prioritizeSelectedMicroAction,
} from "@/lib/utils/habit-rules";
import { planMicroActionsSchema, type PlanMicroActionInput } from "@/lib/validators/backend";
import type { Database, DifficultyLevel } from "@/types";

function shiftDifficulty(current: DifficultyLevel, direction: "easier" | "harder"): DifficultyLevel {
  const order: DifficultyLevel[] = ["gentle", "steady", "hard"];
  const currentIndex = order.indexOf(current);

  if (direction === "easier") {
    return order[Math.max(0, currentIndex - 1)];
  }

  return order[Math.min(order.length - 1, currentIndex + 1)];
}

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
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "먼저 온보딩을 완료해 주세요." : "Complete onboarding first.")}`);
  }

  const client = await getSupabaseServerClient();
  const currentActions = await loadReviewActionsForSession(client, session);
  const adjustedActions = adjustReviewActions(currentActions, direction, locale);
  const notice =
    direction === "easier"
      ? locale === "ko"
        ? "방금 더 쉽게 조정했어요."
        : "We made it easier just now."
      : locale === "ko"
        ? "방금 조금 더 크게 조정했어요."
        : "We made it slightly bigger just now.";

  await setHabitSession({
    ...session,
    userId: user.id,
    reviewActions: adjustedActions,
  });

  redirect(`/onboarding/review?notice=${encodeURIComponent(notice)}`);
}

export async function regenerateOnboardingReviewPlan() {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "먼저 온보딩을 완료해 주세요." : "Complete onboarding first.")}`);
  }

  const client = await getSupabaseServerClient();
  const { data: goalData, error: goalError } = await client
    .from("goals")
    .select("title, difficulty, available_minutes, anchor_id")
    .eq("id", session.goalId)
    .eq("user_id", user.id)
    .maybeSingle();

  const goal = goalData as Pick<
    Database["public"]["Tables"]["goals"]["Row"],
    "title" | "difficulty" | "available_minutes" | "anchor_id"
  > | null;

  if (goalError || !goal) {
    throw new Error(goalError?.message ?? "Goal not found.");
  }

  const anchorResult = goal.anchor_id
    ? await client.from("anchors").select("cue, preferred_time").eq("id", goal.anchor_id).maybeSingle()
    : { data: null, error: null };
  const anchor = anchorResult.data as Pick<Database["public"]["Tables"]["anchors"]["Row"], "cue" | "preferred_time"> | null;
  const nextDifficulty = session.reviewDifficulty ?? goal.difficulty;
  const decomposition = await generateHabitDecomposition(
    {
      goal: goal.title,
      availableMinutes: goal.available_minutes,
      difficulty: nextDifficulty,
      preferredTime: anchor?.preferred_time ?? "morning",
      anchor: anchor?.cue ?? (locale === "ko" ? "아침 커피를 마신 직후" : "right after my morning coffee"),
    },
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
    reviewDifficulty: nextDifficulty,
  });

  redirect(`/onboarding/review?notice=${encodeURIComponent(locale === "ko" ? "전체 플랜을 다시 만들었어요." : "We regenerated the full plan.")}`);
}

export async function finalizeOnboardingReview(formData: FormData) {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId || !session.planId) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "먼저 온보딩을 완료해 주세요." : "Complete onboarding first.")}`);
  }

  const rawActions = String(formData.get("actionsJson") ?? "[]");
  const selectedPosition = Number(formData.get("selectedPosition") ?? 1);

  let parsedActions: PlanMicroActionInput[];

  try {
    parsedActions = planMicroActionsSchema.parse(JSON.parse(rawActions));
  } catch {
    redirect(`/onboarding/review?error=${encodeURIComponent(locale === "ko" ? "행동 수정 내용을 읽지 못했어요." : "We could not read the edited actions.")}`);
  }

  const prioritizedActions = prioritizeSelectedMicroAction(parsedActions, selectedPosition);
  const client = await getSupabaseServerClient();
  const planResult = (await createPlanVersion(client, {
    userId: user.id,
    goalId: session.goalId,
    source: "manual",
    basedOnPlanId: session.planId,
    notes: locale === "ko" ? "온보딩 검토에서 확정한 플랜" : "Plan finalized after onboarding review.",
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
    userId: user.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroAction.id,
    dailyActionId: dailyAction.id,
    reviewActions: undefined,
    reviewDifficulty: undefined,
  });

  redirect("/today");
}
