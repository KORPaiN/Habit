"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { getLocale } from "@/lib/locale";
import { createOnboardingFlow } from "@/lib/supabase/habit-service";
import { getAuthenticatedUser, syncAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { setHabitSession } from "@/lib/habit-session";
import { onboardingSchema } from "@/lib/validators/habit";
import { mapGeneratedActionsToPlanInput } from "@/lib/utils/habit-rules";

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
      decomposition: {
        microActions: Array<{
          title: string;
          reason: string;
          durationMinutes: number;
          fallbackAction: string;
        }>;
      };
      initialPlan: {
        plan: { id: string };
        micro_actions: Array<{ id: string; position: number }>;
      };
    };

    await setHabitSession({
      userId,
      goalId: result.goal.id,
      planId: result.initialPlan.plan.id,
      reviewActions: mapGeneratedActionsToPlanInput(result.decomposition.microActions),
      reviewDifficulty: parsed.difficulty,
    });
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : locale === "ko" ? "첫 계획을 만들지 못했어요." : "We could not create your first plan.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  redirect("/onboarding/review");
}
