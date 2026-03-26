import type { MicroAction, OnboardingInput } from "@/lib/validators/habit";

export function minutesLabel(minutes: number) {
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function buildAnchorLabel(anchor: OnboardingInput["anchor"]) {
  const labels: Record<OnboardingInput["anchor"], string> = {
    "after-coffee": "After coffee",
    "after-shower": "After your shower",
    "before-work": "Before work",
    "before-bed": "Before bed",
  };

  return labels[anchor];
}

export function shrinkAction(action: MicroAction): MicroAction {
  return {
    ...action,
    durationMinutes: Math.max(1, action.durationMinutes - 1),
    title: `Smaller step: ${action.title}`,
    reason: "We lowered the bar so starting feels safer today.",
  };
}
