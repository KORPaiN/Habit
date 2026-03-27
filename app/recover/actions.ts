"use server";

import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { generateHabitDecomposition } from "@/lib/ai";
import { getLocale } from "@/lib/locale";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getRecoveryContextFromSession } from "@/lib/supabase/demo-data";
import { assignDailyAction, createPlanVersion, failDailyAction } from "@/lib/supabase/habit-service";
import { mapGeneratedActionsToPlanInput, prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { microActionSchema } from "@/lib/validators/habit";
import { failureReasonSchema } from "@/lib/validators/backend";

type RecoveryReason = "too_big" | "too_tired" | "forgot" | "schedule_conflict" | "low_motivation" | "other";

export type RecoveryOption = {
  position: number;
  title: string;
  reason: string;
  durationMinutes: number;
  fallbackAction: string;
};

export type RecoveryPreparationResult = {
  reason: RecoveryReason;
  options: RecoveryOption[];
  savedFailure: boolean;
};

function canUseSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function prepareRecoveryOptions(input: { failureReason: RecoveryReason }): Promise<RecoveryPreparationResult> {
  const locale = await getLocale();
  const reason = failureReasonSchema.parse(input.failureReason);
  const session = await getHabitSession();

  if (!session.userId) {
    throw new Error(locale === "ko" ? "먼저 Google로 로그인해 주세요." : "Please sign in with Google first.");
  }

  const context = await getRecoveryContextFromSession(session);

  if (!context) {
    throw new Error("Create a plan before opening recovery.");
  }

  let savedFailure = false;

  if (canUseSupabase()) {
    try {
      if (!session.dailyActionId) {
        throw new Error("Missing daily action id");
      }

      await failDailyAction(getSupabaseAdminClient(), session.dailyActionId, {
        userId: session.userId,
        failureReason: reason,
        notes: "User opened recovery flow and asked for a smaller step.",
        createRecoveryPlan: false,
      });
      savedFailure = true;
    } catch {
      savedFailure = false;
    }
  }

  const decomposition = await generateHabitDecomposition(context.onboarding, {
    failureReason: reason,
    locale,
  });

  const options = decomposition.microActions.map((action, index) => ({
    position: index + 1,
    ...microActionSchema.parse(action),
  }));

  return {
    reason,
    options,
    savedFailure,
  };
}

export async function saveRecoveryChoice(input: {
  failureReason: RecoveryReason;
  selectedPosition: number;
  options: RecoveryOption[];
}): Promise<{
  selectedAction: RecoveryOption;
  savedSelection: boolean;
}> {
  const reason = failureReasonSchema.parse(input.failureReason);
  const options = input.options.map((option) => ({
    position: option.position,
    ...microActionSchema.parse(option),
  }));
  const selectedAction = options.find((option) => option.position === input.selectedPosition) ?? options[0];

  if (!selectedAction) {
    throw new Error("No recovery option was selected.");
  }

  let savedSelection = false;
  const session = await getHabitSession();

  if (!session.userId) {
    throw new Error("Please sign in with Google first.");
  }

  if (canUseSupabase()) {
    try {
      if (!session.goalId) {
        throw new Error("Missing goal id");
      }

      const prioritizedActions = prioritizeSelectedMicroAction(
        mapGeneratedActionsToPlanInput(options),
        input.selectedPosition,
      );
      const planResult = await createPlanVersion(getSupabaseAdminClient(), {
        userId: session.userId,
        goalId: session.goalId,
        source: "recovery",
        notes: `Recovery plan created after failure reason: ${reason}.`,
        microActions: prioritizedActions,
      });

      const plan = planResult as {
        plan: { id: string };
        micro_actions: Array<{ id: string; position: number }>;
      };

      const selectedMicroActionId = plan.micro_actions.find((item) => item.position === 1)?.id;

      if (!selectedMicroActionId) {
        throw new Error("Recovery plan did not return a selected micro-action.");
      }

      const dailyAction = (await assignDailyAction(getSupabaseAdminClient(), {
        userId: session.userId,
        goalId: session.goalId,
        planId: plan.plan.id,
        microActionId: selectedMicroActionId,
        actionDate: new Date().toISOString().slice(0, 10),
      })) as { id: string };

      await setHabitSession({
        ...session,
        planId: plan.plan.id,
        microActionId: selectedMicroActionId,
        dailyActionId: dailyAction.id,
      });

      savedSelection = true;
    } catch {
      savedSelection = false;
    }
  }

  return {
    selectedAction,
    savedSelection,
  };
}

export async function getRecoveryPageState() {
  const session = await getHabitSession();
  const context = await getRecoveryContextFromSession(session);

  if (!context) {
    return null;
  }

  return {
    currentAction: context.currentAction,
    goal: context.goal,
  };
}
