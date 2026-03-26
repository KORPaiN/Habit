"use server";

import { generateHabitDecomposition } from "@/lib/ai";
import { demoBackendIds, mockOnboardingData, mockPlan } from "@/lib/utils/mock-habit";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
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
  const reason = failureReasonSchema.parse(input.failureReason);
  let savedFailure = false;

  if (canUseSupabase()) {
    try {
      await failDailyAction(getSupabaseAdminClient(), demoBackendIds.dailyActionId, {
        userId: demoBackendIds.userId,
        failureReason: reason,
        notes: "User opened recovery flow and asked for a smaller step.",
        createRecoveryPlan: false,
      });
      savedFailure = true;
    } catch {
      savedFailure = false;
    }
  }

  const decomposition = await generateHabitDecomposition(mockOnboardingData, {
    failureReason: reason,
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

  if (canUseSupabase()) {
    try {
      const prioritizedActions = prioritizeSelectedMicroAction(
        mapGeneratedActionsToPlanInput(options),
        input.selectedPosition,
      );
      const planResult = await createPlanVersion(getSupabaseAdminClient(), {
        userId: demoBackendIds.userId,
        goalId: demoBackendIds.goalId,
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

      await assignDailyAction(getSupabaseAdminClient(), {
        userId: demoBackendIds.userId,
        goalId: demoBackendIds.goalId,
        planId: plan.plan.id,
        microActionId: selectedMicroActionId,
        actionDate: new Date().toISOString().slice(0, 10),
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
  return {
    currentAction: mockPlan[0],
    goal: mockOnboardingData.goal,
  };
}
