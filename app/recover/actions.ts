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
    throw new Error(locale === "ko" ? "리커버리를 열기 전에 먼저 계획을 만들어 주세요." : "Create a plan before opening recovery.");
  }

  let savedFailure = false;

  if (canUseSupabase()) {
    try {
      if (!session.dailyActionId) {
        throw new Error("daily action id가 없습니다.");
      }

      await failDailyAction(getSupabaseAdminClient(), session.dailyActionId, {
        userId: session.userId,
        failureReason: reason,
        notes: "사용자가 리커버리에서 더 작은 단계를 요청했습니다.",
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
    throw new Error("선택된 리커버리 옵션이 없습니다.");
  }

  let savedSelection = false;
  const session = await getHabitSession();

  if (!session.userId) {
    throw new Error("먼저 Google로 로그인해 주세요.");
  }

  if (canUseSupabase()) {
    try {
      if (!session.goalId) {
        throw new Error("goal id가 없습니다.");
      }

      const prioritizedActions = prioritizeSelectedMicroAction(
        mapGeneratedActionsToPlanInput(options),
        input.selectedPosition,
      );
      const planResult = await createPlanVersion(getSupabaseAdminClient(), {
        userId: session.userId,
        goalId: session.goalId,
        source: "recovery",
        notes: `실패 사유 ${reason} 이후 리커버리 플랜을 생성했습니다.`,
        microActions: prioritizedActions,
      });

      const plan = planResult as {
        plan: { id: string };
        micro_actions: Array<{ id: string; position: number }>;
      };

      const selectedMicroActionId = plan.micro_actions.find((item) => item.position === 1)?.id;

      if (!selectedMicroActionId) {
        throw new Error("리커버리 플랜에서 선택된 마이크로 액션을 찾지 못했습니다.");
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
