import type { Locale } from "@/lib/locale";
import type { MicroAction, OnboardingInput } from "@/lib/validators/habit";

export function minutesLabel(minutes: number, locale: Locale = "en") {
  if (locale === "ko") {
    return `${minutes}분`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function buildAnchorLabel(anchor: OnboardingInput["anchor"], locale: Locale = "en") {
  const labels: Record<Locale, Record<OnboardingInput["anchor"], string>> = {
    en: {
      "after-coffee": "After coffee",
      "after-shower": "After your shower",
      "before-work": "Before work",
      "before-bed": "Before bed",
    },
    ko: {
      "after-coffee": "커피 마신 뒤",
      "after-shower": "샤워한 뒤",
      "before-work": "일 시작 전",
      "before-bed": "잠들기 전",
    },
  };

  return labels[locale][anchor];
}

export function shrinkAction(action: MicroAction, locale: Locale = "en"): MicroAction {
  return {
    ...action,
    durationMinutes: Math.max(1, action.durationMinutes - 1),
    title: locale === "ko" ? `더 작은 단계: ${action.title}` : `Smaller step: ${action.title}`,
    reason: locale === "ko" ? "시작이 더 편해지도록 문턱을 낮췄어요." : "We lowered the bar so starting feels safer today.",
  };
}
