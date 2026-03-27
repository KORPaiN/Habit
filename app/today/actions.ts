"use server";

import { redirect } from "next/navigation";

import { getHabitSession, hasActiveHabitSelection } from "@/lib/habit-session";
import { completeDailyAction, generateWeeklyReview } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export async function completeTodayAction() {
  const session = await getHabitSession();

  if (!session.userId) {
    redirect("/login?next=%2Ftoday&error=Sign%20in%20with%20Google%20before%20updating%20today%27s%20action.");
  }

  if (!hasActiveHabitSelection(session) || !session.dailyActionId || !session.goalId) {
    redirect("/onboarding?error=Create your first plan before marking an action complete.");
  }

  try {
    const client = getSupabaseAdminClient();

    await completeDailyAction(client, session.dailyActionId, {
      userId: session.userId,
      usedFallback: false,
      notes: "Completed from the today screen.",
    });

    await generateWeeklyReview(client, {
      userId: session.userId,
      goalId: session.goalId,
    });

    redirect("/review?completed=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "We could not complete this action.";
    redirect(`/today?error=${encodeURIComponent(message)}`);
  }
}
