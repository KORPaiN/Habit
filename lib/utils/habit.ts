import type { Locale } from "@/lib/locale";
import type { MicroAction } from "@/lib/validators/habit";

export function minutesLabel(minutes: number, locale: Locale = "ko") {
  if (locale === "ko") {
    return `${minutes}분`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function shrinkAction(action: MicroAction, locale: Locale = "ko"): MicroAction {
  return {
    ...action,
    durationMinutes: Math.max(1, action.durationMinutes - 1),
    title: locale === "ko" ? `더 작은 단계: ${action.title}` : `Smaller step: ${action.title}`,
    reason: locale === "ko" ? "시작이 더 편해지도록 문턱을 낮췄어요." : "We lowered the bar so starting feels safer today.",
  };
}
