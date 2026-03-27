import type { SupabaseClient } from "@supabase/supabase-js";

import { generateHabitDecomposition } from "@/lib/ai";
import type { Locale } from "@/lib/locale";
import type { Database } from "@/types";
import type {
  AssignDailyActionRequest,
  CreatePlanRequest,
  OnboardingRequest,
  WeeklyReviewRequest,
} from "@/lib/validators/backend";
import { mapGeneratedActionsToPlanInput } from "@/lib/utils/habit-rules";
import type { SavedAnchorInput } from "@/lib/validators/habit";

type ServiceClient = SupabaseClient<Database>;
type AnchorInsert = Database["public"]["Tables"]["anchors"]["Insert"];
type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];

type OnboardingResult = {
  goal: { id: string };
  anchor: { id: string };
};

function isDuplicateAnchorConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes('anchors_user_id_label_cue_key');
}

function toRpcMicroActions(actions: CreatePlanRequest["microActions"]) {
  return actions.map((action) => ({
    position: action.position,
    title: action.title,
    details: action.details ?? null,
    duration_minutes: action.durationMinutes,
    fallback_title: action.fallbackTitle,
    fallback_details: action.fallbackDetails ?? null,
    fallback_duration_minutes: action.fallbackDurationMinutes,
  }));
}

async function runRpc<T>(client: ServiceClient, fn: string, params: Record<string, unknown>) {
  const { data, error } = await (client as SupabaseClient).rpc(fn, params);

  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

async function createOnboardingGoalWithAnchorReuse(
  client: ServiceClient,
  input: OnboardingRequest,
): Promise<OnboardingResult> {
  const anchorsTable = client.from("anchors" as never) as any;
  const goalsTable = client.from("goals" as never) as any;

  const existingAnchorQuery = await anchorsTable
    .select("id")
    .eq("user_id", input.userId)
    .eq("label", input.anchorLabel)
    .eq("cue", input.anchorCue)
    .maybeSingle();

  if (existingAnchorQuery.error) {
    throw new Error(existingAnchorQuery.error.message);
  }

  let anchorId = existingAnchorQuery.data?.id;

  if (!anchorId) {
    const insertedAnchor = await anchorsTable
      .insert({
        user_id: input.userId,
        label: input.anchorLabel,
        cue: input.anchorCue,
        preferred_time: input.preferredTime,
      } satisfies AnchorInsert)
      .select("id")
      .single();

    if (insertedAnchor.error) {
      throw new Error(insertedAnchor.error.message);
    }

    anchorId = insertedAnchor.data.id;
  } else {
    const updatedAnchor = await anchorsTable
      .update({
        preferred_time: input.preferredTime,
      } satisfies Partial<AnchorInsert>)
      .eq("id", anchorId)
      .select("id")
      .single();

    if (updatedAnchor.error) {
      throw new Error(updatedAnchor.error.message);
    }
  }

  const insertedGoal = await goalsTable
    .insert({
      user_id: input.userId,
      anchor_id: anchorId,
      title: input.goalTitle,
      why: input.goalWhy ?? null,
      difficulty: input.difficulty,
      available_minutes: input.availableMinutes,
    } satisfies GoalInsert)
    .select("id")
    .single();

  if (insertedGoal.error) {
    throw new Error(insertedGoal.error.message);
  }

  return {
    goal: { id: insertedGoal.data.id },
    anchor: { id: anchorId },
  };
}

export async function createOnboardingFlow(client: ServiceClient, input: OnboardingRequest & { locale?: Locale }) {
  let onboardingResult: OnboardingResult;

  try {
    onboardingResult = await runRpc<OnboardingResult>(client, "create_onboarding_goal", {
      p_user_id: input.userId,
      p_goal_title: input.goalTitle,
      p_goal_why: input.goalWhy ?? null,
      p_difficulty: input.difficulty,
      p_available_minutes: input.availableMinutes,
      p_anchor_label: input.anchorLabel,
      p_anchor_cue: input.anchorCue,
      p_preferred_time: input.preferredTime,
    });
  } catch (error) {
    if (!isDuplicateAnchorConstraintError(error)) {
      throw error;
    }

    onboardingResult = await createOnboardingGoalWithAnchorReuse(client, input);
  }

  const decomposition = await generateHabitDecomposition({
    goal: input.goalTitle,
    availableMinutes: input.availableMinutes,
    difficulty: input.difficulty,
    preferredTime: input.preferredTime,
    anchor: input.anchorCue,
  }, {
    locale: input.locale,
    allowMockFallback: false,
  });

  const generatedActions = input.microActions ?? mapGeneratedActionsToPlanInput(decomposition.microActions);

  const planResult = await runRpc(client, "create_habit_plan", {
    p_user_id: input.userId,
    p_goal_id: onboardingResult.goal.id,
    p_source: "ai",
    p_micro_actions: toRpcMicroActions(generatedActions),
    p_based_on_plan_id: null,
    p_notes: "초기 온보딩 플랜",
  });

  return {
    ...onboardingResult,
    decomposition,
    initialPlan: planResult,
  };
}

export async function createPlanVersion(client: ServiceClient, input: CreatePlanRequest) {
  return runRpc(client, "create_habit_plan", {
    p_user_id: input.userId,
    p_goal_id: input.goalId,
    p_source: input.source,
    p_micro_actions: toRpcMicroActions(input.microActions),
    p_based_on_plan_id: input.basedOnPlanId ?? null,
    p_notes: input.notes ?? null,
  });
}

export async function getUserAnchors(client: ServiceClient, userId: string) {
  const anchorsTable = client.from("anchors" as never) as any;
  const { data, error } = await anchorsTable
    .select("id, label, cue, preferred_time, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveUserAnchor(client: ServiceClient, input: SavedAnchorInput & { userId: string }) {
  const anchorsTable = client.from("anchors" as never) as any;
  const { data, error } = await anchorsTable
    .upsert(
      {
        user_id: input.userId,
        label: input.cue,
        cue: input.cue,
        preferred_time: "morning",
      },
      {
        onConflict: "user_id,label,cue",
      },
    )
    .select("id, label, cue, preferred_time, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteUserAnchor(client: ServiceClient, input: { userId: string; anchorId: string }) {
  const anchorsTable = client.from("anchors" as never) as any;
  const { error } = await anchorsTable.delete().eq("user_id", input.userId).eq("id", input.anchorId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function assignDailyAction(client: ServiceClient, input: AssignDailyActionRequest) {
  return runRpc(client, "assign_daily_action", {
    p_user_id: input.userId,
    p_goal_id: input.goalId,
    p_plan_id: input.planId,
    p_micro_action_id: input.microActionId,
    p_action_date: input.actionDate ?? new Date().toISOString().slice(0, 10),
  });
}

export async function completeDailyAction(
  client: ServiceClient,
  dailyActionId: string,
  input: { userId: string; usedFallback: boolean; notes?: string | null },
) {
  return runRpc(client, "complete_daily_action", {
    p_user_id: input.userId,
    p_daily_action_id: dailyActionId,
    p_used_fallback: input.usedFallback,
    p_notes: input.notes ?? null,
  });
}

export async function failDailyAction(
  client: ServiceClient,
  dailyActionId: string,
  input: { userId: string; failureReason: string; notes?: string | null; createRecoveryPlan: boolean },
) {
  return runRpc(client, "report_daily_action_failure", {
    p_user_id: input.userId,
    p_daily_action_id: dailyActionId,
    p_failure_reason: input.failureReason,
    p_notes: input.notes ?? null,
    p_create_recovery_plan: input.createRecoveryPlan,
  });
}

export async function upsertWeeklyReview(client: ServiceClient, input: WeeklyReviewRequest) {
  return runRpc(client, "upsert_weekly_review", {
    p_user_id: input.userId,
    p_goal_id: input.goalId,
    p_week_start: input.weekStart,
    p_completed_days: input.completedDays,
    p_skipped_days: input.skippedDays,
    p_failed_days: input.failedDays,
    p_best_streak: input.bestStreak,
    p_difficult_moments: input.difficultMoments,
    p_helpful_pattern: input.helpfulPattern,
    p_next_adjustment: input.nextAdjustment,
    p_summary: input.summary ?? null,
  });
}

export async function getWeeklyReview(client: ServiceClient, input: { userId: string; goalId: string; weekStart: string }) {
  const { data, error } = await client
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", input.userId)
    .eq("goal_id", input.goalId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function getWeekStart(date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
}

function countStatuses(statuses: Array<Database["public"]["Tables"]["daily_actions"]["Row"]["status"]>, target: Database["public"]["Tables"]["daily_actions"]["Row"]["status"]) {
  return statuses.filter((status) => status === target).length;
}

function getBestStreak(statuses: Array<Database["public"]["Tables"]["daily_actions"]["Row"]["status"]>) {
  let best = 0;
  let current = 0;

  for (const status of statuses) {
    if (status === "completed") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

export async function generateWeeklyReview(client: ServiceClient, input: { userId: string; goalId: string; weekStart?: string }) {
  const weekStart = input.weekStart ?? getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndString = weekEnd.toISOString().slice(0, 10);

  const { data, error } = await client
    .from("daily_actions")
    .select("status, used_fallback")
    .eq("goal_id", input.goalId)
    .gte("action_date", weekStart)
    .lte("action_date", weekEndString)
    .order("action_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ status: Database["public"]["Tables"]["daily_actions"]["Row"]["status"]; used_fallback: boolean }>;
  const statuses = rows.map((row) => row.status);
  const completedDays = countStatuses(statuses, "completed");
  const failedDays = countStatuses(statuses, "failed");
  const skippedDays = countStatuses(statuses, "skipped");
  const usedFallbackDays = rows.filter((row) => row.used_fallback).length;

  const difficultMoments =
    failedDays > 0
      ? "이번 주에는 여전히 버겁게 느껴진 날이 있었어요. 첫 단계는 한 번 더 가볍게 줄일 필요가 있습니다."
      : skippedDays > 1
        ? "바쁜 날에 자주 놓쳤다면 의지 문제보다 앵커와 타이밍이 더 선명해져야 한다는 뜻입니다."
        : "이번 주에는 저항이 비교적 낮아서 현재 단계 크기가 무난해 보입니다.";

  const helpfulPattern =
    usedFallbackDays > 0
      ? "에너지가 낮은 날에도 대체 행동이 흐름을 이어 주었습니다."
      : completedDays >= 4
        ? "작고 구체적인 행동일수록 망설임 없이 시작하기 쉬웠습니다."
        : "가장 쉬웠던 날은 준비 마찰이 적었던 날이었을 가능성이 큽니다.";

  const nextAdjustment =
    failedDays > 0
      ? "다음 주에는 시작 문턱을 더 낮추고 대체 행동을 더 눈에 띄게 만드세요."
      : completedDays >= 4
        ? "지금 크기를 당분간 유지하고 같은 작은 진입점을 반복하세요."
        : "앵커를 더 분명히 해서 행동이 하루 중 더 이르게 떠오르도록 해보세요.";

  return upsertWeeklyReview(client, {
    userId: input.userId,
    goalId: input.goalId,
    weekStart,
    completedDays,
    skippedDays,
    failedDays,
    bestStreak: getBestStreak(statuses),
    difficultMoments,
    helpfulPattern,
    nextAdjustment,
    summary: null,
  });
}
