"use server";

import { redirect } from "next/navigation";

import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { assignDailyAction, createPlanVersion } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { planMicroActionsSchema } from "@/lib/validators/backend";

export async function finalizeOnboardingReview(formData: FormData) {
  const locale = await getLocale();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId || !session.planId) {
    redirect(`/onboarding?error=${encodeURIComponent(locale === "ko" ? "먼저 온보딩을 완료해 주세요." : "Complete onboarding first.")}`);
  }

  const rawActions = String(formData.get("actionsJson") ?? "[]");
  const selectedPosition = Number(formData.get("selectedPosition") ?? 1);

  let parsedActions;

  try {
    parsedActions = planMicroActionsSchema.parse(JSON.parse(rawActions));
  } catch {
    redirect(`/onboarding/review?error=${encodeURIComponent(locale === "ko" ? "행동 수정 내용을 읽지 못했어요." : "We could not read the edited actions.")}`);
  }

  const prioritizedActions = prioritizeSelectedMicroAction(parsedActions, selectedPosition);
  const client = await getSupabaseServerClient();
  const planResult = (await createPlanVersion(client, {
    userId: user.id,
    goalId: session.goalId,
    source: "manual",
    basedOnPlanId: session.planId,
    notes: locale === "ko" ? "온보딩 검토 후 확정한 플랜" : "Plan finalized after onboarding review.",
    microActions: prioritizedActions,
  })) as {
    plan: { id: string };
    micro_actions: Array<{ id: string; position: number }>;
  };

  const selectedMicroAction = planResult.micro_actions.find((action) => action.position === 1);

  if (!selectedMicroAction) {
    redirect(`/onboarding/review?error=${encodeURIComponent(locale === "ko" ? "오늘 행동을 고르지 못했어요." : "We could not choose today's action.")}`);
  }

  const dailyAction = (await assignDailyAction(client, {
    userId: user.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroAction.id,
    actionDate: new Date().toISOString().slice(0, 10),
  })) as { id: string };

  await setHabitSession({
    userId: user.id,
    goalId: session.goalId,
    planId: planResult.plan.id,
    microActionId: selectedMicroAction.id,
    dailyActionId: dailyAction.id,
  });

  redirect("/today");
}
