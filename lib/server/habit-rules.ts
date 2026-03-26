import type { MicroAction } from "@/lib/schemas/habit";
import type { PlanMicroActionInput } from "@/lib/schemas/backend";

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
