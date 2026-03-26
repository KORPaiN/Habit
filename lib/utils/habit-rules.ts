import type { MicroAction } from "@/lib/validators/habit";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

export function mapGeneratedActionsToPlanInput(actions: MicroAction[]): PlanMicroActionInput[] {
  return actions.slice(0, 3).map((action, index) => ({
    position: index + 1,
    title: action.title,
    details: action.reason,
    durationMinutes: action.durationMinutes,
    fallbackTitle: action.fallbackAction,
    fallbackDetails: "Use the lighter fallback when the main step still feels too heavy.",
    fallbackDurationMinutes: 1,
  }));
}

export function buildRecoveryPreview(actions: PlanMicroActionInput[], selectedPosition: number): PlanMicroActionInput[] {
  return actions.map((action) => {
    if (action.position !== selectedPosition) {
      return action;
    }

    return {
      ...action,
      title: `Smaller step: ${action.title}`,
      details: action.details ?? "We lowered the bar so this feels easier to restart.",
      durationMinutes: Math.max(1, action.durationMinutes - 1),
    };
  });
}

export function prioritizeSelectedMicroAction(actions: PlanMicroActionInput[], selectedPosition: number): PlanMicroActionInput[] {
  const selected = actions.find((action) => action.position === selectedPosition);
  const remaining = actions.filter((action) => action.position !== selectedPosition);

  if (!selected) {
    return actions;
  }

  return [selected, ...remaining].map((action, index) => ({
    ...action,
    position: index + 1,
  }));
}
