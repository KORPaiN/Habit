"use server";

import { redirect } from "next/navigation";

import { getLocale } from "@/lib/locale";
import { assignDailyAction, createOnboardingFlow } from "@/lib/supabase/habit-service";
import { getAuthenticatedUser, syncAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { setHabitSession } from "@/lib/habit-session";
import { buildAnchorLabel } from "@/lib/utils/habit";
import { onboardingSchema } from "@/lib/validators/habit";

function buildAnchorCue(anchor: ReturnType<typeof onboardingSchema.parse>["anchor"]) {
  const cues: Record<ReturnType<typeof onboardingSchema.parse>["anchor"], string> = {
    "after-coffee": "첫 커피를 한 모금 마신 직후",
    "after-shower": "샤워를 마친 직후",
    "before-work": "일을 시작하기 직전",
    "before-bed": "침대에 눕기 직전",
  };

  return cues[anchor];
}

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

    const client = getSupabaseAdminClient();
    const userId = authenticatedUser.id;
    const result = (await createOnboardingFlow(client, {
      userId,
      goalTitle: parsed.goal,
      goalWhy: null,
      difficulty: parsed.difficulty,
      availableMinutes: parsed.availableMinutes,
      anchorKey: parsed.anchor,
      anchorLabel: buildAnchorLabel(parsed.anchor, locale),
      anchorCue: buildAnchorCue(parsed.anchor),
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
    const message = error instanceof Error ? error.message : locale === "ko" ? "첫 계획을 만들지 못했어요." : "We could not create your first plan.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  redirect("/today");
}
