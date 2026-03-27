import { getSupabaseAdminClient } from "@/lib/supabase/client";
import type { HabitSession } from "@/lib/habit-session";
import type { Database, DailyActionStatus } from "@/types";
import type { MicroAction, OnboardingInput } from "@/lib/validators/habit";

type GoalLookup = Database["public"]["Tables"]["goals"]["Row"];
type AnchorLookup = Database["public"]["Tables"]["anchors"]["Row"];
type DailyActionLookup = Database["public"]["Tables"]["daily_actions"]["Row"];
type MicroActionLookup = Database["public"]["Tables"]["micro_actions"]["Row"];
type WeeklyReviewLookup = Database["public"]["Tables"]["weekly_reviews"]["Row"];

type TodayState = {
  goal: string;
  anchor: string;
  action: MicroAction;
  source: "Supabase";
  goalId: string;
  planId: string;
  microActionId: string;
  dailyActionId: string;
};

type RecoveryContext = {
  goal: string;
  onboarding: OnboardingInput;
  currentAction: MicroAction;
};

type WeeklyReviewState = {
  completedDays: number;
  streakDays: number;
  difficultMoments: string;
  helpfulPattern: string;
  nextAdjustment: string;
  source: "Supabase";
};

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseConfigured() {
  return isConfigured();
}

function mapAnchorLabelToKey(label?: string | null): OnboardingInput["anchor"] {
  switch (label) {
    case "After coffee":
      return "after-coffee";
    case "After your shower":
    case "After shower":
      return "after-shower";
    case "Before work":
      return "before-work";
    default:
      return "before-bed";
  }
}

function mapRowToMicroAction(row: Pick<MicroActionLookup, "title" | "details" | "duration_minutes" | "fallback_title">): MicroAction {
  return {
    title: row.title,
    reason: row.details ?? "A tiny visible action is easier to begin.",
    durationMinutes: row.duration_minutes,
    fallbackAction: row.fallback_title,
  };
}

async function getGoalForSession(session: HabitSession) {
  const client = getSupabaseAdminClient();

  const query = client
    .from("goals")
    .select("*")
    .eq("user_id", session.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (session.goalId) {
    query.eq("id", session.goalId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GoalLookup | null) ?? null;
}

async function getAnchor(anchorId?: string | null) {
  if (!anchorId) {
    return null;
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("anchors").select("*").eq("id", anchorId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AnchorLookup | null) ?? null;
}

async function getDailyActionForGoal(goalId: string, preferredDailyActionId?: string) {
  const client = getSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  if (preferredDailyActionId) {
    const byId = await client.from("daily_actions").select("*").eq("id", preferredDailyActionId).maybeSingle();

    if (byId.error) {
      throw new Error(byId.error.message);
    }

    if (byId.data) {
      return byId.data as DailyActionLookup;
    }
  }

  const todayAction = await client
    .from("daily_actions")
    .select("*")
    .eq("goal_id", goalId)
    .eq("action_date", today)
    .maybeSingle();

  if (todayAction.error) {
    throw new Error(todayAction.error.message);
  }

  if (todayAction.data) {
    return todayAction.data as DailyActionLookup;
  }

  const latestAction = await client
    .from("daily_actions")
    .select("*")
    .eq("goal_id", goalId)
    .order("action_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestAction.error) {
    throw new Error(latestAction.error.message);
  }

  return (latestAction.data as DailyActionLookup | null) ?? null;
}

async function getMicroAction(microActionId?: string) {
  if (!microActionId) {
    return null;
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("micro_actions").select("*").eq("id", microActionId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MicroActionLookup | null) ?? null;
}

function getWeekStart(date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
}

function getStatusCount(statuses: DailyActionStatus[], target: DailyActionStatus) {
  return statuses.filter((status) => status === target).length;
}

function getBestStreak(statuses: DailyActionStatus[]) {
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

function buildGeneratedReview(statuses: DailyActionStatus[]): WeeklyReviewState {
  const completedDays = getStatusCount(statuses, "completed");
  const failedDays = getStatusCount(statuses, "failed");
  const skippedDays = getStatusCount(statuses, "skipped");
  const streakDays = getBestStreak(statuses);

  const difficultMoments =
    failedDays > 0
      ? "Hard days showed up this week, so the plan still needs a smaller first move."
      : skippedDays > 1
        ? "The habit was easy to miss on some days, which suggests the cue or timing needs to be clearer."
        : "There was not much visible resistance this week, which is a good sign that the step stayed light enough.";

  const helpfulPattern =
    completedDays >= 4
      ? "Keeping the step small made it easier to return without overthinking."
      : "The days that worked were probably the days with the least setup friction.";

  const nextAdjustment =
    failedDays > 0
      ? "Make the first action even more observable next week and protect the fallback."
      : completedDays >= 4
        ? "Keep the same size for now and repeat the easiest version."
        : "Tighten the cue so today's step appears earlier and asks for less energy.";

  return {
    completedDays,
    streakDays,
    difficultMoments,
    helpfulPattern,
    nextAdjustment,
    source: "Supabase",
  };
}

export async function getTodayStateFromSession(session: HabitSession): Promise<TodayState | null> {
  if (!isConfigured()) {
    return null;
  }

  const goal = await getGoalForSession(session);

  if (!goal) {
    return null;
  }

  const [anchor, dailyAction] = await Promise.all([getAnchor(goal.anchor_id), getDailyActionForGoal(goal.id, session.dailyActionId)]);

  if (!dailyAction) {
    return null;
  }

  const microAction = await getMicroAction(session.microActionId ?? dailyAction.micro_action_id);

  if (!microAction) {
    return null;
  }

  return {
    goal: goal.title,
    anchor: anchor?.label ?? "No anchor yet",
    action: mapRowToMicroAction(microAction),
    source: "Supabase",
    goalId: goal.id,
    planId: dailyAction.plan_id,
    microActionId: microAction.id,
    dailyActionId: dailyAction.id,
  };
}

export async function getRecoveryContextFromSession(session: HabitSession): Promise<RecoveryContext | null> {
  const todayState = await getTodayStateFromSession(session);

  if (!todayState) {
    return null;
  }

  const goal = await getGoalForSession({ ...session, goalId: todayState.goalId });
  const anchor = goal?.anchor_id ? await getAnchor(goal.anchor_id) : null;

  if (!goal) {
    return null;
  }

  return {
    goal: goal.title,
    onboarding: {
      goal: goal.title,
      availableMinutes: goal.available_minutes,
      difficulty: goal.difficulty,
      preferredTime: anchor?.preferred_time ?? "morning",
      anchor: mapAnchorLabelToKey(anchor?.label),
    },
    currentAction: todayState.action,
  };
}

export async function getWeeklyReviewStateFromSession(session: HabitSession): Promise<WeeklyReviewState | null> {
  if (!isConfigured()) {
    return null;
  }

  const goal = await getGoalForSession(session);

  if (!goal) {
    return null;
  }

  const client = getSupabaseAdminClient();
  const weekStart = getWeekStart();

  const existingReview = await client
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", session.userId)
    .eq("goal_id", goal.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingReview.error) {
    throw new Error(existingReview.error.message);
  }

  if (existingReview.data) {
    const data = existingReview.data as WeeklyReviewLookup;
    return {
      completedDays: data.completed_days,
      streakDays: data.best_streak,
      difficultMoments: data.difficult_moments,
      helpfulPattern: data.helpful_pattern,
      nextAdjustment: data.next_adjustment,
      source: "Supabase",
    };
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndString = weekEnd.toISOString().slice(0, 10);

  const weeklyActions = await client
    .from("daily_actions")
    .select("status")
    .eq("goal_id", goal.id)
    .gte("action_date", weekStart)
    .lte("action_date", weekEndString)
    .order("action_date", { ascending: true });

  if (weeklyActions.error) {
    throw new Error(weeklyActions.error.message);
  }

  const statuses = ((weeklyActions.data ?? []) as Array<{ status: DailyActionStatus }>).map((item) => item.status);

  return buildGeneratedReview(statuses);
}
