import { Card } from "@/components/ui/card";
import { buildAnchorLabel, minutesLabel } from "@/lib/habit";
import type { OnboardingInput } from "@/lib/schemas/habit";

type OnboardingPreviewProps = {
  values: OnboardingInput;
};

export function OnboardingPreview({ values }: OnboardingPreviewProps) {
  return (
    <Card className="h-full">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Preview</p>
      <h2 className="mt-3 text-xl font-semibold">A gentle plan for this week</h2>
      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Goal</dt>
          <dd className="mt-1 font-medium">{values.goal}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Daily time</dt>
          <dd className="mt-1 font-medium">{minutesLabel(values.availableMinutes)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Difficulty</dt>
          <dd className="mt-1 font-medium capitalize">{values.difficulty}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Preferred window</dt>
          <dd className="mt-1 font-medium capitalize">{values.preferredTime}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Anchor</dt>
          <dd className="mt-1 font-medium">{buildAnchorLabel(values.anchor)}</dd>
        </div>
      </dl>
      <p className="mt-6 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
        We will use this to suggest 1 to 3 micro-actions and keep a fallback ready for harder days.
      </p>
    </Card>
  );
}
