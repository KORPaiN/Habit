import type { SupabaseClient } from "@supabase/supabase-js";

import { generateHabitDecomposition } from "@/lib/services/ai";
import type { Database } from "@/lib/types/database";
import type {
  AssignDailyActionRequest,
  CreatePlanRequest,
  OnboardingRequest,
  WeeklyReviewRequest,
} from "@/lib/schemas/backend";
import { mapGeneratedActionsToPlanInput } from "@/lib/server/habit-rules";

type ServiceClient = SupabaseClient<Database>;

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

export async function createOnboardingFlow(client: ServiceClient, input: OnboardingRequest) {
  const onboardingResult = await runRpc<{
    goal: { id: string };
    anchor: { id: string };
  }>(client, "create_onboarding_goal", {
    p_user_id: input.userId,
    p_goal_title: input.goalTitle,
    p_goal_why: input.goalWhy ?? null,
    p_difficulty: input.difficulty,
    p_available_minutes: input.availableMinutes,
    p_anchor_label: input.anchorLabel,
    p_anchor_cue: input.anchorCue,
    p_preferred_time: input.preferredTime,
  });

  const decomposition = await generateHabitDecomposition({
    goal: input.goalTitle,
    availableMinutes: input.availableMinutes,
    difficulty: input.difficulty,
    preferredTime: input.preferredTime,
    anchor: input.anchorKey,
  });

  const generatedActions = input.microActions ?? mapGeneratedActionsToPlanInput(decomposition.microActions);

  const planResult = await runRpc(client, "create_habit_plan", {
    p_user_id: input.userId,
    p_goal_id: onboardingResult.goal.id,
    p_source: "ai",
    p_micro_actions: toRpcMicroActions(generatedActions),
    p_based_on_plan_id: null,
    p_notes: "Initial onboarding plan.",
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
