"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { getLocale } from "@/lib/locale";
import { assignDailyAction, createOnboardingFlow } from "@/lib/supabase/habit-service";
import { getAuthenticatedUser, syncAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { setHabitSession } from "@/lib/habit-session";
import { onboardingSchema } from "@/lib/validators/habit";

export async function submitOnboarding(formData: FormData) {
  const locale = await getLocale();
  const parsed = onboardingSchema.parse({
    goal: formData.get("goal"),
    availableMinutes: formData.get("availableMinutes"),
    difficulty: formData.get("difficulty"),
    preferredTime: formData.get("preferredTime"),
    anchor: formData.get("anchor"),
  });

  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser) {
      redirect(`/login?next=${encodeURIComponent("/onboarding")}&error=${encodeURIComponent(locale === "ko" ? "Google 로그인 후 계획을 저장할 수 있어요." : "Sign in with Google before saving your plan.")}`);
    }

    await syncAuthenticatedUser();

    const client = await getSupabaseServerClient();
    const userId = authenticatedUser.id;
    const result = (await createOnboardingFlow(client, {
      userId,
      goalTitle: parsed.goal,
      goalWhy: null,
      difficulty: parsed.difficulty,
      availableMinutes: parsed.availableMinutes,
      anchorLabel: parsed.anchor,
      anchorCue: parsed.anchor,
      preferredTime: parsed.preferredTime,
      locale,
    })) as {
      goal: { id: string };
      initialPlan: {
        plan: { id: string };
        micro_actions: Array<{ id: string; position: number }>;
      };
    };

    const selectedMicroAction = result.initialPlan.micro_actions.find((action) => action.position === 1);

    if (!selectedMicroAction) {
      throw new Error("온보딩 플랜에 첫 행동이 포함되지 않았어요.");
    }

    const dailyAction = (await assignDailyAction(client, {
      userId,
      goalId: result.goal.id,
      planId: result.initialPlan.plan.id,
      microActionId: selectedMicroAction.id,
      actionDate: new Date().toISOString().slice(0, 10),
    })) as { id: string };

    await setHabitSession({
      userId,
      goalId: result.goal.id,
      planId: result.initialPlan.plan.id,
      microActionId: selectedMicroAction.id,
      dailyActionId: dailyAction.id,
    });
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : locale === "ko" ? "첫 계획을 만들지 못했어요." : "We could not create your first plan.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  redirect("/today");
}
