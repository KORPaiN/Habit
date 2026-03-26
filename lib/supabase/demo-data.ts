import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { demoBackendIds, mockOnboardingData, mockPlan, mockWeeklySummary } from "@/lib/utils/mock-habit";
import type { MicroAction, OnboardingInput } from "@/lib/validators/habit";

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseConfigured() {
  return isConfigured();
}

export async function getDemoTodayState(): Promise<{
  goal: string;
  anchor: string;
  action: MicroAction;
}> {
  if (!isConfigured()) {
    return {
      goal: mockOnboardingData.goal,
      anchor: "After coffee",
      action: mockPlan[0],
    };
  }

  try {
    const client = getSupabaseAdminClient();
    const goalQuery = await client
      .from("goals")
      .select("id, title, anchor_id")
      .eq("id", demoBackendIds.goalId)
      .maybeSingle();
    const goal = goalQuery.data as { id: string; title: string; anchor_id: string | null } | null;

    const anchorQuery = goal?.anchor_id
      ? await client.from("anchors").select("label").eq("id", goal.anchor_id).maybeSingle()
      : { data: null };
    const anchor = anchorQuery.data as { label: string } | null;

    const dailyActionQuery = await client
      .from("daily_actions")
      .select("micro_action_id")
      .eq("goal_id", demoBackendIds.goalId)
      .order("action_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dailyAction = dailyActionQuery.data as { micro_action_id: string } | null;

    const microActionQuery = dailyAction?.micro_action_id
      ? await client
          .from("micro_actions")
          .select("title, details, duration_minutes, fallback_title")
          .eq("id", dailyAction.micro_action_id)
          .maybeSingle()
      : { data: null };
    const microAction = microActionQuery.data as {
      title: string;
      details: string | null;
      duration_minutes: number;
      fallback_title: string;
    } | null;

    if (!goal || !microAction) {
      throw new Error("Missing demo data");
    }

    return {
      goal: goal.title,
      anchor: anchor?.label ?? "After coffee",
      action: {
        title: microAction.title,
        reason: microAction.details ?? "A tiny step keeps the habit alive.",
        durationMinutes: microAction.duration_minutes,
        fallbackAction: microAction.fallback_title,
      },
    };
  } catch {
    return {
      goal: mockOnboardingData.goal,
      anchor: "After coffee",
      action: mockPlan[0],
    };
  }
}

export async function getDemoRecoveryContext(): Promise<{
  goal: string;
  onboarding: OnboardingInput;
  currentAction: MicroAction;
}> {
  if (!isConfigured()) {
    return {
      goal: mockOnboardingData.goal,
      onboarding: mockOnboardingData,
      currentAction: mockPlan[0],
    };
  }

  try {
    const client = getSupabaseAdminClient();
    const goalQuery = await client
      .from("goals")
      .select("title, difficulty, available_minutes, anchor_id")
      .eq("id", demoBackendIds.goalId)
      .maybeSingle();
    const goal = goalQuery.data as {
      title: string;
      difficulty: OnboardingInput["difficulty"];
      available_minutes: number;
      anchor_id: string | null;
    } | null;

    const anchorQuery = goal?.anchor_id
      ? await client.from("anchors").select("label, preferred_time").eq("id", goal.anchor_id).maybeSingle()
      : { data: null };
    const anchor = anchorQuery.data as {
      label: string;
      preferred_time: OnboardingInput["preferredTime"];
    } | null;

    const todayState = await getDemoTodayState();

    if (!goal) {
      throw new Error("Missing goal");
    }

    const anchorKey =
      anchor?.label === "After coffee"
        ? "after-coffee"
        : anchor?.label === "After your shower"
          ? "after-shower"
          : anchor?.label === "Before work"
            ? "before-work"
            : "before-bed";

    return {
      goal: goal.title,
      onboarding: {
        goal: goal.title,
        availableMinutes: goal.available_minutes,
        difficulty: goal.difficulty,
        preferredTime: anchor?.preferred_time ?? "morning",
        anchor: anchorKey,
      },
      currentAction: todayState.action,
    };
  } catch {
    return {
      goal: mockOnboardingData.goal,
      onboarding: mockOnboardingData,
      currentAction: mockPlan[0],
    };
  }
}

export async function getDemoWeeklyReviewState() {
  if (!isConfigured()) {
    return mockWeeklySummary;
  }

  try {
    const client = getSupabaseAdminClient();
    const reviewQuery = await client
      .from("weekly_reviews")
      .select("completed_days, best_streak, difficult_moments, helpful_pattern, next_adjustment")
      .eq("goal_id", demoBackendIds.goalId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    const data = reviewQuery.data as {
      completed_days: number;
      best_streak: number;
      difficult_moments: string;
      helpful_pattern: string;
      next_adjustment: string;
    } | null;

    if (!data) {
      throw new Error("Missing weekly review");
    }

    return {
      completedDays: data.completed_days,
      streakDays: data.best_streak,
      difficultMoments: data.difficult_moments,
      helpfulPattern: data.helpful_pattern,
      nextAdjustment: data.next_adjustment,
    };
  } catch {
    return mockWeeklySummary;
  }
}
