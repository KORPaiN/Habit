import type { SupabaseClient } from "@supabase/supabase-js";

import { generateHabitDecompositionFromSelection } from "@/lib/ai";
import type { Locale } from "@/lib/locale";
import type { Database } from "@/types";
import type {
  AssignDailyActionRequest as AssignDailyActionPayload,
  BehaviorSwarmCandidateInput,
  CreatePlanRequest as CreatePlanPayload,
  OnboardingRequest as OnboardingPayload,
  WeeklyReviewRequest as WeeklyReviewPayload,
} from "@/lib/validators/backend";
import { mapGeneratedActionsToPlanInput } from "@/lib/utils/habit-rules";
import type { SavedAnchorInput } from "@/lib/validators/habit";

type ServiceClient = SupabaseClient<Database>;
type AnchorInsert = Database["public"]["Tables"]["anchors"]["Insert"];
type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];
type GoalUpdate = Database["public"]["Tables"]["goals"]["Update"];
type GoalAnchorInsert = Database["public"]["Tables"]["goal_anchors"]["Insert"];
type BehaviorSwarmCandidateInsert = Database["public"]["Tables"]["behavior_swarm_candidates"]["Insert"];
type AuthenticatedOnboardingRequest = OnboardingPayload & { userId: string; locale?: Locale };
type AuthenticatedCreatePlanRequest = CreatePlanPayload & { userId: string };
type AuthenticatedAssignDailyActionRequest = AssignDailyActionPayload & { userId: string };
type AuthenticatedWeeklyReviewRequest = WeeklyReviewPayload & { userId: string };

type OnboardingResult = {
  goal: { id: string };
  anchor: { id: string };
};

function isDuplicateAnchorConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes("anchors_user_id_label_cue_key");
}

function toRpcMicroActions(actions: CreatePlanPayload["microActions"]) {
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

async function upsertAnchor(
  client: ServiceClient,
  input: { userId: string; cue: string; preferredTime: Database["public"]["Tables"]["anchors"]["Row"]["preferred_time"] },
) {
  const anchorsTable = client.from("anchors" as never) as any;
  const { data, error } = await anchorsTable
    .upsert(
      {
        user_id: input.userId,
        label: input.cue,
        cue: input.cue,
        preferred_time: input.preferredTime,
      } satisfies AnchorInsert,
      {
        onConflict: "user_id,label,cue",
      },
    )
    .select("id, cue, label, preferred_time")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "label" | "preferred_time">;
}

async function syncGoalAnchors(
  client: ServiceClient,
  input: {
    userId: string;
    goalId: string;
    primaryAnchor: string;
    preferredTime: Database["public"]["Tables"]["anchors"]["Row"]["preferred_time"];
  },
) {
  const primary = await upsertAnchor(client, {
    userId: input.userId,
    cue: input.primaryAnchor,
    preferredTime: input.preferredTime,
  });

  const goalAnchorsTable = client.from("goal_anchors" as never) as any;
  const goalsTable = client.from("goals" as never) as any;

  const { error: deleteError } = await goalAnchorsTable.delete().eq("goal_id", input.goalId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows: GoalAnchorInsert[] = [
    {
      goal_id: input.goalId,
      anchor_id: primary.id,
      anchor_type: "primary",
      sort_order: 0,
    },
  ];

  const { error: insertError } = await goalAnchorsTable.insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: goalUpdateError } = await goalsTable.update({ anchor_id: primary.id }).eq("id", input.goalId);

  if (goalUpdateError) {
    throw new Error(goalUpdateError.message);
  }

  return {
    primary,
  };
}

async function replaceSwarmCandidates(
  client: ServiceClient,
  input: {
    goalId: string;
    candidates: BehaviorSwarmCandidateInput[];
    selectedBehavior: BehaviorSwarmCandidateInput;
  },
) {
  const candidatesTable = client.from("behavior_swarm_candidates" as never) as any;
  const { error: deleteError } = await candidatesTable.delete().eq("goal_id", input.goalId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows: BehaviorSwarmCandidateInsert[] = input.candidates.map((candidate) => ({
    goal_id: input.goalId,
    title: candidate.title,
    details: candidate.details ?? null,
    duration_minutes: candidate.durationMinutes,
    desire_score: candidate.desireScore,
    ability_score: candidate.abilityScore,
    impact_score: candidate.impactScore,
    selected: candidate.title === input.selectedBehavior.title,
  }));

  const { data, error } = await candidatesTable
    .insert(rows)
    .select("id, title, selected");

  if (error) {
    throw new Error(error.message);
  }

  const selected = ((data ?? []) as Array<{ id: string; title: string; selected: boolean }>).find((candidate) => candidate.selected);

  return {
    selectedCandidateId: selected?.id ?? null,
  };
}

function normalizeCandidate(candidate: BehaviorSwarmCandidateInput) {
  return {
    ...candidate,
    details: candidate.details ?? "",
  };
}

async function createOnboardingGoalWithAnchorReuse(
  client: ServiceClient,
  input: AuthenticatedOnboardingRequest,
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
      desired_outcome: input.desiredOutcome,
      motivation_note: null,
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

async function buildSelectionPlan(
  client: ServiceClient,
  input: AuthenticatedOnboardingRequest & {
    goalId: string;
    basedOnPlanId?: string | null;
    source?: AuthenticatedCreatePlanRequest["source"];
  },
) {
  const selectedBehavior = normalizeCandidate(input.selectedBehavior);
  const swarmCandidates = input.swarmCandidates.map(normalizeCandidate);

  await syncGoalAnchors(client, {
    userId: input.userId,
    goalId: input.goalId,
    primaryAnchor: input.anchorCue,
    preferredTime: input.preferredTime,
  });

  const candidateResult = await replaceSwarmCandidates(client, {
    goalId: input.goalId,
    candidates: swarmCandidates,
    selectedBehavior,
  });

  const decomposition = await generateHabitDecompositionFromSelection(
    {
      goal: input.goalTitle,
      desiredOutcome: input.desiredOutcome,
      availableMinutes: input.availableMinutes,
      difficulty: input.difficulty,
      preferredTime: input.preferredTime,
      anchor: input.anchorCue,
      selectedBehavior,
      swarmCandidates,
      recipeText: input.recipeText,
      celebrationText: input.celebrationText,
      mode: "create",
    },
    selectedBehavior,
    {
      locale: input.locale,
      strategy: "ai_only",
      modelPreference: "fast",
      userId: input.userId,
      goalId: input.goalId,
      basedOnPlanId: input.basedOnPlanId ?? undefined,
    },
  );

  const generatedActions = input.microActions ?? mapGeneratedActionsToPlanInput(decomposition.microActions);
  const initialPlan = await createPlanVersion(client, {
    userId: input.userId,
    goalId: input.goalId,
    source: input.source ?? "ai",
    basedOnPlanId: input.basedOnPlanId ?? null,
    notes: input.source === "manual" ? "행동 재선택 계획" : "초기 온보딩 계획",
    recipeText: input.recipeText,
    celebrationText: input.celebrationText,
    rehearsalCount: input.rehearsalCount,
    selectedCandidateId: candidateResult.selectedCandidateId,
    microActions: generatedActions,
  });

  return {
    decomposition,
    selectedCandidateId: candidateResult.selectedCandidateId,
    initialPlan,
  };
}

export async function createOnboardingFlow(client: ServiceClient, input: AuthenticatedOnboardingRequest) {
  let onboardingResult: OnboardingResult;

  try {
    onboardingResult = await runRpc<OnboardingResult>(client, "create_onboarding_goal", {
      p_user_id: input.userId,
      p_goal_title: input.goalTitle,
      p_goal_why: input.goalWhy ?? null,
      p_desired_outcome: input.desiredOutcome,
      p_motivation_note: null,
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

  const planState = await buildSelectionPlan(client, {
    ...input,
    goalId: onboardingResult.goal.id,
    source: "ai",
  });

  return {
    ...onboardingResult,
    ...planState,
  };
}

export async function reselectGoalPlan(
  client: ServiceClient,
  input: AuthenticatedOnboardingRequest & { goalId: string; basedOnPlanId?: string | null },
) {
  const goalsTable = client.from("goals" as never) as any;
  const { error } = await goalsTable
    .update({
      title: input.goalTitle,
      why: input.goalWhy ?? null,
      desired_outcome: input.desiredOutcome,
      motivation_note: null,
      difficulty: input.difficulty,
      available_minutes: input.availableMinutes,
    } satisfies GoalUpdate)
    .eq("id", input.goalId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(error.message);
  }

  const planState = await buildSelectionPlan(client, {
    ...input,
    source: "manual",
  });

  return {
    goal: { id: input.goalId },
    ...planState,
  };
}

export async function createPlanVersion(client: ServiceClient, input: AuthenticatedCreatePlanRequest) {
  return runRpc(client, "create_habit_plan", {
    p_user_id: input.userId,
    p_goal_id: input.goalId,
    p_source: input.source,
    p_micro_actions: toRpcMicroActions(input.microActions),
    p_based_on_plan_id: input.basedOnPlanId ?? null,
    p_notes: input.notes ?? null,
    p_recipe_text: input.recipeText ?? null,
    p_celebration_text: input.celebrationText ?? null,
    p_rehearsal_count: input.rehearsalCount ?? 0,
    p_selected_candidate_id: input.selectedCandidateId ?? null,
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

export async function assignDailyAction(client: ServiceClient, input: AuthenticatedAssignDailyActionRequest) {
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

export async function upsertWeeklyReview(client: ServiceClient, input: AuthenticatedWeeklyReviewRequest) {
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

function countStatuses(
  statuses: Array<Database["public"]["Tables"]["daily_actions"]["Row"]["status"]>,
  target: Database["public"]["Tables"]["daily_actions"]["Row"]["status"],
) {
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
      ? "어려운 날에는 행동을 더 작게 줄일 필요가 있었습니다."
      : skippedDays > 1
        ? "바쁜 날에는 붙일 루틴이 더 분명해야 했습니다."
        : "이번 주 흐름은 비교적 가벼웠습니다.";

  const helpfulPattern =
    usedFallbackDays > 0
      ? "대체 행동이 흐름을 지켜줬습니다."
      : completedDays >= 4
        ? "작고 분명한 행동이 시작을 쉽게 만들었습니다."
        : "준비 동작이 있으면 시작이 더 쉬웠습니다.";

  const nextAdjustment =
    failedDays > 0
      ? "다음 주에는 첫 행동을 더 가볍게 유지해 보세요."
      : completedDays >= 4
        ? "지금 크기를 유지하며 반복해 보세요."
        : "붙일 루틴을 더 눈에 띄게 바꿔 보세요.";

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
