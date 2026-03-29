"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser, syncAuthenticatedUser } from "@/lib/supabase/auth";
import { createOnboardingFlow, reselectGoalPlan } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { mapGeneratedActionsToPlanInput } from "@/lib/utils/habit-rules";
import {
  DEFAULT_AVAILABLE_MINUTES,
  DEFAULT_DIFFICULTY,
  DEFAULT_PREFERRED_TIME,
  behaviorSwarmCandidateSchema,
  behaviorSwarmSchema,
  onboardingSchema,
} from "@/lib/validators/habit";

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function submitOnboarding(formData: FormData) {
  const locale = await getLocale();
  const selectedBehavior = behaviorSwarmCandidateSchema.parse(parseJsonField(formData.get("selectedBehaviorJson"), {}));
  const swarmCandidates = behaviorSwarmSchema.parse(parseJsonField(formData.get("swarmCandidatesJson"), []));
  const parsed = onboardingSchema.parse({
    goal: formData.get("goal"),
    desiredOutcome: formData.get("desiredOutcome"),
    anchor: formData.get("anchor"),
    selectedBehavior,
    swarmCandidates,
    recipeText: formData.get("recipeText"),
    celebrationText: formData.get("celebrationText"),
    mode: formData.get("mode") ?? "create",
  });

  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser) {
      redirect(
        `/login?next=${encodeURIComponent("/onboarding?resume=1&step=5")}&error=${encodeURIComponent(
          locale === "ko" ? "로그인 후 저장할 수 있어요." : "Sign in with Google before saving your plan.",
        )}`,
      );
    }

    await syncAuthenticatedUser();

    const client = await getSupabaseServerClient();
    const userId = authenticatedUser.id;
    const session = await getHabitSession();
    const basePayload = {
      userId,
      goalTitle: parsed.goal,
      goalWhy: null,
      desiredOutcome: parsed.desiredOutcome,
      difficulty: DEFAULT_DIFFICULTY,
      availableMinutes: DEFAULT_AVAILABLE_MINUTES,
      anchorLabel: parsed.anchor,
      anchorCue: parsed.anchor,
      preferredTime: DEFAULT_PREFERRED_TIME,
      selectedBehavior: parsed.selectedBehavior,
      swarmCandidates: parsed.swarmCandidates,
      recipeText: parsed.recipeText,
      celebrationText: parsed.celebrationText,
      rehearsalCount: 0,
      locale,
    };
    const result = (
      parsed.mode === "reselect" && session.goalId
        ? await reselectGoalPlan(client, {
            ...basePayload,
            goalId: session.goalId,
            basedOnPlanId: session.planId ?? null,
          })
        : await createOnboardingFlow(client, basePayload)) as {
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
      };
    };

    await setHabitSession({
      userId,
      goalId: result.goal.id,
      planId: result.initialPlan.plan.id,
      reviewActions: mapGeneratedActionsToPlanInput(result.decomposition.microActions),
    });
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : locale === "ko" ? "첫 계획을 만들지 못했어요." : "We could not create your first plan.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  redirect("/onboarding?review=1");
}
