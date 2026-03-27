"use server";

import { generateHabitDecomposition } from "@/lib/ai";
import { getHabitSession, setHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getRecoveryContextFromSession } from "@/lib/supabase/demo-data";
import { assignDailyAction, createPlanVersion, failDailyAction } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { mapGeneratedActionsToPlanInput, prioritizeSelectedMicroAction } from "@/lib/utils/habit-rules";
import { failureReasonSchema } from "@/lib/validators/backend";
import { microActionSchema } from "@/lib/validators/habit";

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
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function prepareRecoveryOptions(input: { failureReason: RecoveryReason }): Promise<RecoveryPreparationResult> {
  const locale = await getLocale();
  const reason = failureReasonSchema.parse(input.failureReason);
  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    throw new Error(locale === "ko" ? "癒쇱? Google濡?濡쒓렇?명빐 二쇱꽭??" : "Please sign in with Google first.");
  }

  const context = await getRecoveryContextFromSession(session);

  if (!context) {
    throw new Error(locale === "ko" ? "由ъ빱踰꾨━瑜??닿린 ?꾩뿉 癒쇱? 怨꾪쉷??留뚮뱾??二쇱꽭??" : "Create a plan before opening recovery.");
  }

  let savedFailure = false;

  if (canUseSupabase()) {
    try {
      if (!session.dailyActionId) {
        throw new Error("daily action id媛 ?놁뒿?덈떎.");
      }

      await failDailyAction(await getSupabaseServerClient(), session.dailyActionId, {
        userId: authenticatedUser.id,
        failureReason: reason,
        notes: "?ъ슜?먭? 由ъ빱踰꾨━?먯꽌 ???묒? ?④퀎瑜??붿껌?덉뒿?덈떎.",
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
    allowMockFallback: false,
    userId: authenticatedUser.id,
    goalId: session.goalId ?? undefined,
    basedOnPlanId: session.planId ?? undefined,
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
    throw new Error("?좏깮??由ъ빱踰꾨━ ?듭뀡???놁뒿?덈떎.");
  }

  const session = await getHabitSession();
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    throw new Error("癒쇱? Google濡?濡쒓렇?명빐 二쇱꽭??");
  }

  let savedSelection = false;

  if (canUseSupabase()) {
    try {
      if (!session.goalId) {
        throw new Error("goal id媛 ?놁뒿?덈떎.");
      }

      const client = await getSupabaseServerClient();
      const prioritizedActions = prioritizeSelectedMicroAction(
        mapGeneratedActionsToPlanInput(options),
        input.selectedPosition,
      );
      const planResult = await createPlanVersion(client, {
        userId: authenticatedUser.id,
        goalId: session.goalId,
        source: "recovery",
        notes: `?ㅽ뙣 ?ъ쑀 ${reason} ?댄썑 由ъ빱踰꾨━ ?뚮옖???앹꽦?덉뒿?덈떎.`,
        microActions: prioritizedActions,
      });

      const plan = planResult as {
        plan: { id: string };
        micro_actions: Array<{ id: string; position: number }>;
      };

      const selectedMicroActionId = plan.micro_actions.find((item) => item.position === 1)?.id;

      if (!selectedMicroActionId) {
        throw new Error("由ъ빱踰꾨━ ?뚮옖?먯꽌 ?좏깮??留덉씠?щ줈 ?≪뀡??李얠? 紐삵뻽?듬땲??");
      }

      const dailyAction = (await assignDailyAction(client, {
        userId: authenticatedUser.id,
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
