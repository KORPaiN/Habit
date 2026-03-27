"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser, syncAuthenticatedUser } from "@/lib/supabase/auth";
import { createOnboardingFlow, reselectGoalPlan } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { mapGeneratedActionsToPlanInput } from "@/lib/utils/habit-rules";
import { behaviorSwarmSchema, behaviorSwarmCandidateSchema, onboardingSchema } from "@/lib/validators/habit";

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
  const backupAnchors = parseJsonField<string[]>(formData.get("backupAnchorsJson"), []);
  const parsed = onboardingSchema.parse({
    goal: formData.get("goal"),
    desiredOutcome: formData.get("desiredOutcome"),
    motivationNote: formData.get("motivationNote"),
    availableMinutes: formData.get("availableMinutes"),
    difficulty: formData.get("difficulty"),
    preferredTime: formData.get("preferredTime"),
    anchor: formData.get("anchor"),
    backupAnchors,
    selectedBehavior,
    swarmCandidates,
    recipeText: formData.get("recipeText"),
    celebrationText: formData.get("celebrationText"),
    rehearsalCount: formData.get("rehearsalCount"),
    mode: formData.get("mode") ?? "create",
  });

  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser) {
      redirect(`/login?next=${encodeURIComponent("/onboarding")}&error=${encodeURIComponent(locale === "ko" ? "로그인 후 계속할 수 있어요." : "Sign in with Google before saving your plan.")}`);
    }

    await syncAuthenticatedUser();

    const client = await getSupabaseServerClient();
    const userId = authenticatedUser.id;
    const session = await getHabitSession();
    const result = (
      parsed.mode === "reselect" && session.goalId
        ? await reselectGoalPlan(client, {
            userId,
            goalId: session.goalId,
            basedOnPlanId: session.planId ?? null,
            goalTitle: parsed.goal,
            goalWhy: parsed.motivationNote || null,
            desiredOutcome: parsed.desiredOutcome,
            motivationNote: parsed.motivationNote || null,
            difficulty: parsed.difficulty,
            availableMinutes: parsed.availableMinutes,
            anchorLabel: parsed.anchor,
            anchorCue: parsed.anchor,
            preferredTime: parsed.preferredTime,
            backupAnchors: parsed.backupAnchors,
            selectedBehavior: parsed.selectedBehavior,
            swarmCandidates: parsed.swarmCandidates,
            recipeText: parsed.recipeText,
            celebrationText: parsed.celebrationText,
            rehearsalCount: parsed.rehearsalCount,
            locale,
          })
        : await createOnboardingFlow(client, {
            userId,
            goalTitle: parsed.goal,
            goalWhy: parsed.motivationNote || null,
            desiredOutcome: parsed.desiredOutcome,
            motivationNote: parsed.motivationNote || null,
            difficulty: parsed.difficulty,
            availableMinutes: parsed.availableMinutes,
            anchorLabel: parsed.anchor,
            anchorCue: parsed.anchor,
            preferredTime: parsed.preferredTime,
            backupAnchors: parsed.backupAnchors,
            selectedBehavior: parsed.selectedBehavior,
            swarmCandidates: parsed.swarmCandidates,
            recipeText: parsed.recipeText,
            celebrationText: parsed.celebrationText,
            rehearsalCount: parsed.rehearsalCount,
            locale,
          })) as {
      goal: { id: string };
      selectedCandidateId?: string | null;
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
      reviewMeta: {
        goal: parsed.goal,
        desiredOutcome: parsed.desiredOutcome,
        motivationNote: parsed.motivationNote,
        availableMinutes: parsed.availableMinutes,
        difficulty: parsed.difficulty,
        preferredTime: parsed.preferredTime,
        selectedBehavior: parsed.selectedBehavior,
        swarmCandidates: parsed.swarmCandidates,
        primaryAnchor: parsed.anchor,
        backupAnchors: parsed.backupAnchors,
        recipeText: parsed.recipeText,
        celebrationText: parsed.celebrationText,
        rehearsalCount: parsed.rehearsalCount,
        selectedCandidateId: result.selectedCandidateId ?? undefined,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : locale === "ko" ? "첫 계획을 만들지 못했어요." : "We could not create your first plan.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  redirect("/onboarding/review");
}
