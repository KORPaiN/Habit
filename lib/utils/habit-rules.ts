import type { Locale } from "@/lib/locale";
import type { MicroAction } from "@/lib/validators/habit";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

export function mapGeneratedActionsToPlanInput(actions: MicroAction[]): PlanMicroActionInput[] {
  return actions.slice(0, 3).map((action, index) => ({
    position: index + 1,
    title: action.title,
    details: action.reason,
    durationMinutes: action.durationMinutes,
    fallbackTitle: action.fallbackAction,
    fallbackDetails: "기본 행동이 버겁다면 더 작은 대체 행동을 써요.",
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
      title: `더 작은 단계: ${action.title}`,
      details: action.details ?? "다시 시작하기 쉽도록 더 줄였어요.",
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

export function getReviewActionSizeLabel(durationMinutes: number, locale: Locale = "ko") {
  if (locale === "ko") {
    if (durationMinutes <= 1) return "아주 작게";
    if (durationMinutes <= 2) return "가볍게";
    if (durationMinutes <= 3) return "보통";
    return "조금 크게";
  }

  if (durationMinutes <= 1) return "Very small";
  if (durationMinutes <= 2) return "Light";
  if (durationMinutes <= 3) return "Steady";
  return "A bit bigger";
}
