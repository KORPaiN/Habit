"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { getHabitSession, hasActiveHabitSelection } from "@/lib/habit-session";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { completeDailyAction, generateWeeklyReview } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function completeTodayAction() {
  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    redirect("/login?next=%2Ftoday&error=%EB%A8%BC%EC%A0%80%20Google%20%EB%A1%9C%EA%B7%B8%EC%9D%B8%ED%95%B4%EC%A3%BC%EC%84%B8%EC%9A%94.");
  }

  if (!hasActiveHabitSelection(session) || !session.dailyActionId || !session.goalId) {
    redirect("/onboarding?error=%EC%98%A4%EB%8A%98%20%ED%96%89%EB%8F%99%EC%9D%B4%20%EC%95%84%EC%A7%81%20%EC%97%86%EC%96%B4%EC%9A%94.%20%EB%A8%BC%EC%A0%80%20%EC%98%A8%EB%B3%B4%EB%94%A9%EC%9D%84%20%EB%A7%88%EC%B9%98%EC%84%B8%EC%9A%94.");
  }

  try {
    const client = await getSupabaseServerClient();

    await completeDailyAction(client, session.dailyActionId, {
      userId: authenticatedUser.id,
      usedFallback: false,
      notes: "오늘 행동 완료",
    });

    await generateWeeklyReview(client, {
      userId: authenticatedUser.id,
      goalId: session.goalId,
    });

    redirect("/today?completed=1");
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "오늘 행동을 완료 처리하지 못했어요.";
    redirect(`/today?error=${encodeURIComponent(message)}`);
  }
}
