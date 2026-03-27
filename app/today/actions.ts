"use server";

import { redirect } from "next/navigation";

import { getHabitSession, hasActiveHabitSelection } from "@/lib/habit-session";
import { completeDailyAction, generateWeeklyReview } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export async function completeTodayAction() {
  const session = await getHabitSession();

  if (!session.userId) {
    redirect("/login?next=%2Ftoday&error=오늘의 행동을 업데이트하려면 먼저 Google로 로그인해%20주세요.");
  }

  if (!hasActiveHabitSelection(session) || !session.dailyActionId || !session.goalId) {
    redirect("/onboarding?error=오늘의 행동을 완료 처리하기 전에 먼저 첫 계획을 만들어 주세요.");
  }

  try {
    const client = getSupabaseAdminClient();

    await completeDailyAction(client, session.dailyActionId, {
      userId: session.userId,
      usedFallback: false,
      notes: "오늘 화면에서 완료 처리했습니다.",
    });

    await generateWeeklyReview(client, {
      userId: session.userId,
      goalId: session.goalId,
    });

    redirect("/review?completed=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "이 행동을 완료 처리하지 못했어요.";
    redirect(`/today?error=${encodeURIComponent(message)}`);
  }
}
