import type { HabitReviewMeta, HabitSession } from "@/lib/habit-session";
import { buildCelebrationSuggestion, buildRecipeText } from "@/lib/utils/habit";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Database, DailyActionStatus } from "@/types";
import type { PlanMicroActionInput } from "@/lib/validators/backend";
import type { BehaviorSwarmCandidate, MicroAction } from "@/lib/validators/habit";

type GoalLookup = Database["public"]["Tables"]["goals"]["Row"];
type AnchorLookup = Database["public"]["Tables"]["anchors"]["Row"];
type GoalAnchorLookup = Database["public"]["Tables"]["goal_anchors"]["Row"];
type BehaviorCandidateLookup = Database["public"]["Tables"]["behavior_swarm_candidates"]["Row"];
type HabitPlanLookup = Database["public"]["Tables"]["habit_plans"]["Row"];
type DailyActionLookup = Database["public"]["Tables"]["daily_actions"]["Row"];
type MicroActionLookup = Database["public"]["Tables"]["micro_actions"]["Row"];
type WeeklyReviewLookup = Database["public"]["Tables"]["weekly_reviews"]["Row"];

type TodayState = {
  goal: string;
  anchor: string;
  action: MicroAction;
  source: "Supabase";
  status: DailyActionStatus;
  goalId: string;
  planId: string;
  microActionId: string;
  dailyActionId: string;
};

type RecoveryContext = {
  goal: string;
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

type MonthlyReviewState = {
  monthLabel: string;
  completedCount: number;
  totalCount: number;
  completionRate: number;
  bestStreak: number;
  calendar: Array<{
    date: string;
    day: number;
    status: DailyActionStatus | "none";
    completedCount: number;
  }>;
  difficultMoments: string;
  helpfulPattern: string;
  nextAdjustment: string;
};

type HabitReviewState = {
  meta: HabitReviewMeta;
  planId: string;
  reviewActions: PlanMicroActionInput[];
};

type SessionAccessContext = {
  client: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  userId: string;
};

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured() {
  return isConfigured();
}

function mapRowToMicroAction(row: Pick<MicroActionLookup, "title" | "details" | "duration_minutes" | "fallback_title">): MicroAction {
  return {
    title: row.title,
    reason: row.details ?? "바로 할 수 있는 작은 행동이에요.",
    durationMinutes: row.duration_minutes,
    fallbackAction: row.fallback_title,
  };
}

function mapRowToPlanAction(
  row: Pick<
    MicroActionLookup,
    "position" | "title" | "details" | "duration_minutes" | "fallback_title" | "fallback_details" | "fallback_duration_minutes"
  >,
): PlanMicroActionInput {
  return {
    position: row.position,
    title: row.title,
    details: row.details ?? "",
    durationMinutes: row.duration_minutes,
    fallbackTitle: row.fallback_title,
    fallbackDetails: row.fallback_details ?? "",
    fallbackDurationMinutes: row.fallback_duration_minutes,
  };
}

function mapCandidateRow(row: BehaviorCandidateLookup): BehaviorSwarmCandidate {
  return {
    id: row.id,
    title: row.title,
    details: row.details ?? "",
    durationMinutes: row.duration_minutes,
    desireScore: row.desire_score ?? 3,
    abilityScore: row.ability_score ?? 3,
    impactScore: row.impact_score ?? 3,
  };
}

async function getSessionAccessContext(): Promise<SessionAccessContext | null> {
  if (!isConfigured()) {
    return null;
  }

  const client = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    client,
    userId: user.id,
  };
}

async function getGoalForSession(session: HabitSession) {
  const context = await getSessionAccessContext();

  if (!context) {
    return null;
  }

  const query = context.client
    .from("goals")
    .select("*")
    .eq("user_id", context.userId)
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

async function getAnchor(client: SessionAccessContext["client"], anchorId?: string | null) {
  if (!anchorId) {
    return null;
  }

  const { data, error } = await client.from("anchors").select("*").eq("id", anchorId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AnchorLookup | null) ?? null;
}

async function getPlanForGoal(client: SessionAccessContext["client"], goalId: string, preferredPlanId?: string) {
  if (preferredPlanId) {
    const { data, error } = await client.from("habit_plans").select("*").eq("id", preferredPlanId).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as HabitPlanLookup;
    }
  }

  const { data, error } = await client
    .from("habit_plans")
    .select("*")
    .eq("goal_id", goalId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as HabitPlanLookup | null) ?? null;
}

async function getPlanActions(client: SessionAccessContext["client"], planId: string) {
  const { data, error } = await client
    .from("micro_actions")
    .select("position, title, details, duration_minutes, fallback_title, fallback_details, fallback_duration_minutes")
    .eq("plan_id", planId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<
    Pick<
      MicroActionLookup,
      "position" | "title" | "details" | "duration_minutes" | "fallback_title" | "fallback_details" | "fallback_duration_minutes"
    >
  >).map(mapRowToPlanAction);
}

async function getGoalAnchors(client: SessionAccessContext["client"], goal: GoalLookup) {
  const { data, error } = await client
    .from("goal_anchors")
    .select("*")
    .eq("goal_id", goal.id)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const goalAnchors = (data ?? []) as GoalAnchorLookup[];
  const anchorIds = goalAnchors.map((item) => item.anchor_id);

  if (anchorIds.length === 0) {
    const fallback = await getAnchor(client, goal.anchor_id);
    return {
      primaryAnchor: fallback?.cue ?? fallback?.label ?? "",
      preferredTime: fallback?.preferred_time ?? "morning",
    };
  }

  const { data: anchors, error: anchorError } = await client.from("anchors").select("*").in("id", anchorIds);

  if (anchorError) {
    throw new Error(anchorError.message);
  }

  const anchorById = new Map(((anchors ?? []) as AnchorLookup[]).map((anchor) => [anchor.id, anchor]));
  const primaryGoalAnchor = goalAnchors.find((item) => item.anchor_type === "primary");
  const primaryAnchor = primaryGoalAnchor ? anchorById.get(primaryGoalAnchor.anchor_id) : undefined;

  return {
    primaryAnchor: primaryAnchor?.cue ?? primaryAnchor?.label ?? "",
    preferredTime: primaryAnchor?.preferred_time ?? "morning",
  };
}

async function getBehaviorCandidates(client: SessionAccessContext["client"], goalId: string) {
  const { data, error } = await client
    .from("behavior_swarm_candidates")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BehaviorCandidateLookup[]).map(mapCandidateRow);
}

function getSelectedBehavior(
  swarmCandidates: BehaviorSwarmCandidate[],
  selectedCandidateId: string | null,
  reviewActions: PlanMicroActionInput[],
) {
  const byId = selectedCandidateId ? swarmCandidates.find((candidate) => candidate.id === selectedCandidateId) : undefined;

  if (byId) {
    return byId;
  }

  if (swarmCandidates.length > 0) {
    return swarmCandidates[0];
  }

  const firstAction = reviewActions[0];

  if (!firstAction) {
    return null;
  }

  return {
    title: firstAction.title,
    details: firstAction.details ?? "",
    durationMinutes: firstAction.durationMinutes,
    desireScore: 3,
    abilityScore: 4,
    impactScore: 3,
  } satisfies BehaviorSwarmCandidate;
}

function getWeekStart(date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
}

function getMonthStart(date = new Date()) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

function getMonthEnd(date = new Date()) {
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  return monthEnd;
}

function normalizeMonthDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
      ? "놓친 날이 있었어요. 행동을 더 줄이거나 붙일 습관을 더 또렷하게 잡아보세요."
      : skippedDays > 1
        ? "건너뛴 날이 있었다면 타이밍을 더 분명하게 잡는 편이 좋아요."
        : "이번 주는 무리 없이 이어지고 있어요.";

  const helpfulPattern =
    completedDays >= 4
      ? "작게 시작한 날에 더 잘 이어졌어요."
      : "준비를 줄이면 시작이 더 쉬워질 수 있어요.";

  const nextAdjustment =
    failedDays > 0
      ? "다음 주에는 첫 행동을 더 작게 줄여보세요."
      : completedDays >= 4
        ? "지금 크기를 유지하면서 반복해보세요."
        : "기존 습관을 더 선명하게 정해보세요.";

  return {
    completedDays,
    streakDays,
    difficultMoments,
    helpfulPattern,
    nextAdjustment,
    source: "Supabase",
  };
}

function formatMonthLabel(date = new Date()) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildMonthlyCalendar(
  actions: Array<Pick<DailyActionLookup, "action_date" | "status">>,
  completedCountsByDate: Map<string, number>,
  now = new Date(),
) {
  const start = getMonthStart(now);
  const end = getMonthEnd(now);
  const statusByDate = new Map(actions.map((action) => [action.action_date, action.status]));
  const calendar: MonthlyReviewState["calendar"] = [];

  for (let day = 1; day <= end.getDate(); day += 1) {
    const current = new Date(start.getFullYear(), start.getMonth(), day);
    const iso = current.toISOString().slice(0, 10);
    const isFuture = current > now;

    calendar.push({
      date: iso,
      day,
      status: isFuture ? "none" : statusByDate.get(iso) ?? "none",
      completedCount: isFuture ? 0 : completedCountsByDate.get(iso) ?? 0,
    });
  }

  return calendar;
}

function buildMonthlyReview(
  actions: Array<Pick<DailyActionLookup, "action_date" | "status">>,
  completedCountsByDate: Map<string, number>,
  now = new Date(),
): MonthlyReviewState {
  const statuses = actions.map((item) => item.status);
  const completedCount = getStatusCount(statuses, "completed");
  const totalCount = actions.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const bestStreak = getBestStreak(statuses);
  const failedDays = getStatusCount(statuses, "failed");
  const skippedDays = getStatusCount(statuses, "skipped");

  const difficultMoments =
    failedDays > 0
      ? "막힌 날이 있었어요. 더 작은 시작이 필요했을 수 있어요."
      : skippedDays > 2
        ? "건너뛴 날이 많다면 붙일 습관을 더 선명하게 정해보세요."
        : "이번 달 흐름은 비교적 부드러웠어요.";

  const helpfulPattern =
    completionRate >= 60
      ? "작은 행동으로 시작한 날에 완료가 더 잘 이어졌어요."
      : "어느 날이 쉬웠는지 찾으면 다음 달이 더 쉬워져요.";

  const nextAdjustment =
    completionRate >= 70
      ? "다음 달에도 지금 크기를 유지해보세요."
      : "다음 달에는 첫 행동을 더 줄여보세요.";

  return {
    monthLabel: formatMonthLabel(now),
    completedCount,
    totalCount,
    completionRate,
    bestStreak,
    calendar: buildMonthlyCalendar(actions, completedCountsByDate, now),
    difficultMoments,
    helpfulPattern,
    nextAdjustment,
  };
}

async function getDailyActionForGoal(client: SessionAccessContext["client"], goalId: string, preferredDailyActionId?: string) {
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

async function getMicroAction(client: SessionAccessContext["client"], microActionId?: string) {
  if (!microActionId) {
    return null;
  }

  const { data, error } = await client.from("micro_actions").select("*").eq("id", microActionId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MicroActionLookup | null) ?? null;
}

export async function getHabitReviewStateFromSession(session: HabitSession): Promise<HabitReviewState | null> {
  const context = await getSessionAccessContext();

  if (!context) {
    return null;
  }

  const goal = await getGoalForSession(session);

  if (!goal) {
    return null;
  }

  const plan = await getPlanForGoal(context.client, goal.id, session.planId);

  if (!plan) {
    return null;
  }

  const [goalAnchors, dbReviewActions, swarmCandidates] = await Promise.all([
    getGoalAnchors(context.client, goal),
    getPlanActions(context.client, plan.id),
    getBehaviorCandidates(context.client, goal.id),
  ]);

  const reviewActions = session.reviewActions?.length ? session.reviewActions : dbReviewActions;
  const selectedBehavior = getSelectedBehavior(swarmCandidates, plan.selected_candidate_id, reviewActions);

  if (!selectedBehavior) {
    return null;
  }

  const primaryAnchor = goalAnchors.primaryAnchor || "식사 뒤";
  const normalizedSwarmCandidates = swarmCandidates.length > 0 ? swarmCandidates : [selectedBehavior];
  const recipeText = plan.recipe_text ?? buildRecipeText(primaryAnchor, selectedBehavior.title);
  const celebrationText = plan.celebration_text ?? buildCelebrationSuggestion(goal.title);

  return {
    planId: plan.id,
    reviewActions,
    meta: {
      goal: goal.title,
      desiredOutcome: goal.desired_outcome ?? goal.title,
      selectedBehavior,
      swarmCandidates: normalizedSwarmCandidates,
      primaryAnchor,
      recipeText,
      celebrationText,
      selectedCandidateId: plan.selected_candidate_id ?? selectedBehavior.id,
    },
  };
}

export async function getTodayStateFromSession(session: HabitSession): Promise<TodayState | null> {
  const context = await getSessionAccessContext();

  if (!context) {
    return null;
  }

  const goal = await getGoalForSession(session);

  if (!goal) {
    return null;
  }

  const [anchor, dailyAction] = await Promise.all([
    getAnchor(context.client, goal.anchor_id),
    getDailyActionForGoal(context.client, goal.id, session.dailyActionId),
  ]);

  if (!dailyAction) {
    return null;
  }

  const microAction = await getMicroAction(context.client, session.microActionId ?? dailyAction.micro_action_id);

  if (!microAction) {
    return null;
  }

  return {
    goal: goal.title,
    anchor: anchor?.label ?? anchor?.cue ?? "기존 습관 없음",
    action: mapRowToMicroAction(microAction),
    source: "Supabase",
    status: dailyAction.status,
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
  const context = await getSessionAccessContext();
  const anchor = goal?.anchor_id && context ? await getAnchor(context.client, goal.anchor_id) : null;

  if (!goal) {
    return null;
  }

  return {
    goal: goal.title,
    currentAction: todayState.action,
  };
}

export async function getWeeklyReviewStateFromSession(session: HabitSession): Promise<WeeklyReviewState | null> {
  const context = await getSessionAccessContext();

  if (!context) {
    return null;
  }

  const goal = await getGoalForSession(session);

  if (!goal) {
    return null;
  }

  const weekStart = getWeekStart();

  const existingReview = await context.client
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", context.userId)
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

  const weeklyActions = await context.client
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

export async function getMonthlyReviewStateFromSession(session: HabitSession, targetMonth = new Date()): Promise<MonthlyReviewState | null> {
  const context = await getSessionAccessContext();

  if (!context) {
    return null;
  }

  const goal = await getGoalForSession(session);

  if (!goal) {
    return null;
  }

  const monthDate = normalizeMonthDate(targetMonth);
  const monthStart = getMonthStart(monthDate).toISOString().slice(0, 10);
  const monthEnd = getMonthEnd(monthDate).toISOString().slice(0, 10);

  const monthlyActions = await context.client
    .from("daily_actions")
    .select("action_date, status")
    .eq("goal_id", goal.id)
    .gte("action_date", monthStart)
    .lte("action_date", monthEnd)
    .order("action_date", { ascending: true });

  if (monthlyActions.error) {
    throw new Error(monthlyActions.error.message);
  }

  const actions = (monthlyActions.data ?? []) as Array<Pick<DailyActionLookup, "action_date" | "status">>;
  const userGoals = await context.client.from("goals").select("id").eq("user_id", context.userId);

  if (userGoals.error) {
    throw new Error(userGoals.error.message);
  }

  const goalIds = ((userGoals.data ?? []) as Array<{ id: string }>).map((item) => item.id);
  const completedCountsByDate = new Map<string, number>();

  if (goalIds.length > 0) {
    const completedActions = await context.client
      .from("daily_actions")
      .select("action_date")
      .in("goal_id", goalIds)
      .eq("status", "completed")
      .gte("action_date", monthStart)
      .lte("action_date", monthEnd);

    if (completedActions.error) {
      throw new Error(completedActions.error.message);
    }

    for (const action of (completedActions.data ?? []) as Array<{ action_date: string }>) {
      if (!action.action_date) {
        continue;
      }

      completedCountsByDate.set(action.action_date, (completedCountsByDate.get(action.action_date) ?? 0) + 1);
    }
  }

  return buildMonthlyReview(actions, completedCountsByDate, monthDate);
}
