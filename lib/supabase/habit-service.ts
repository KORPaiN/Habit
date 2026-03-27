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

export async function createOnboardingFlow(client: ServiceClient, input: OnboardingRequest & { locale?: Locale }) {
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
  }, {
    locale: input.locale,
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
      ? "Some days still asked for too much, so the step should get lighter again."
      : skippedDays > 1
        ? "The habit was easy to miss on busier days, which points to a cue problem more than a discipline problem."
        : "Resistance stayed fairly low this week, so the current step size looks workable.";

  const helpfulPattern =
    usedFallbackDays > 0
      ? "Having a fallback kept the streak alive on lower-energy days."
      : completedDays >= 4
        ? "Small, specific actions made it easier to begin without negotiation."
        : "The easiest days were probably the ones with the least setup friction.";

  const nextAdjustment =
    failedDays > 0
      ? "Lower the starting bar next week and make the fallback even more obvious."
      : completedDays >= 4
        ? "Keep the plan size steady and repeat the same tiny entry point."
        : "Strengthen the anchor so the action shows up earlier in the day.";

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
