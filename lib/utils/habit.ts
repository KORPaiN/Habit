import type { Locale } from "@/lib/locale";
import type { MicroAction } from "@/lib/validators/habit";

export function minutesLabel(minutes: number, locale: Locale = "ko") {
  if (locale === "ko") {
    return `${minutes}분`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function buildRecipeText(anchor: string, behaviorTitle: string, locale: Locale = "ko") {
  if (locale === "ko") {
    return `${anchor} ${behaviorTitle}`;
  }

  return `After ${anchor}, I will ${behaviorTitle}.`;
}

export function buildCelebrationSuggestion(_goal: string, locale: Locale = "ko") {
  if (locale === "ko") {
    return "좋아, 했다.";
  }

  return "Nice. I did it.";
}

export function buildAnchorReminder(primaryAnchor: string, backupAnchors: string[], locale: Locale = "ko") {
  if (backupAnchors.length === 0) {
    return locale === "ko" ? `앵커: ${primaryAnchor}` : `Anchor: ${primaryAnchor}`;
  }

  return locale === "ko"
    ? `앵커: ${primaryAnchor} / 백업: ${backupAnchors.join(", ")}`
    : `Anchor: ${primaryAnchor} / Backup: ${backupAnchors.join(", ")}`;
}

export function shrinkAction(action: MicroAction, locale: Locale = "ko"): MicroAction {
  return {
    ...action,
    durationMinutes: Math.max(1, action.durationMinutes - 1),
    title: locale === "ko" ? `더 작은 행동: ${action.title}` : `Smaller step: ${action.title}`,
    reason: locale === "ko" ? "시작이 쉬운 쪽으로 줄였습니다." : "We lowered the bar so starting feels safer today.",
  };
}
