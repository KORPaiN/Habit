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
    redirect("/login?next=%2Ftoday&error=?ㅻ뒛???됰룞???낅뜲?댄듃?섎젮硫?癒쇱? Google濡?濡쒓렇?명빐%20二쇱꽭??");
  }

  if (!hasActiveHabitSelection(session) || !session.dailyActionId || !session.goalId) {
    redirect("/onboarding?error=?ㅻ뒛???됰룞???꾨즺 泥섎━?섍린 ?꾩뿉 癒쇱? 泥?怨꾪쉷??留뚮뱾??二쇱꽭??");
  }

  try {
    const client = await getSupabaseServerClient();

    await completeDailyAction(client, session.dailyActionId, {
      userId: authenticatedUser.id,
      usedFallback: false,
      notes: "?ㅻ뒛 ?붾㈃?먯꽌 ?꾨즺 泥섎━?덉뒿?덈떎.",
    });

    await generateWeeklyReview(client, {
      userId: authenticatedUser.id,
      goalId: session.goalId,
    });

    redirect("/today?completed=1");
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "???됰룞???꾨즺 泥섎━?섏? 紐삵뻽?댁슂.";
    redirect(`/today?error=${encodeURIComponent(message)}`);
  }
}
