import Link from "next/link";

import { OnboardingPreview } from "@/components/habit/onboarding-preview";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { mockOnboardingData } from "@/lib/data/mock-habit";
import { minutesLabel } from "@/lib/habit";
import { generateHabitDecomposition } from "@/lib/services/ai";

export default async function OnboardingPage() {
  const decomposition = await generateHabitDecomposition(mockOnboardingData);

  return (
    <PageShell
      eyebrow="Onboarding"
      title="Let's make the goal lighter."
      description="Answer a few short questions so the plan starts small enough to actually happen. The result preview now runs through the server-side AI decomposition flow with schema validation and a safe fallback."
      className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
    >
      <Card>
        <form className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">What goal do you want help starting?</label>
            <Input defaultValue={mockOnboardingData.goal} placeholder="Example: build a reading habit" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Available minutes</label>
              <Input defaultValue={String(mockOnboardingData.availableMinutes)} type="number" min={1} max={30} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Perceived difficulty</label>
              <Select defaultValue={mockOnboardingData.difficulty}>
                <option value="gentle">Gentle</option>
                <option value="steady">Steady</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Preferred time</label>
              <Select defaultValue={mockOnboardingData.preferredTime}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Anchor</label>
              <Select defaultValue={mockOnboardingData.anchor}>
                <option value="after-coffee">After coffee</option>
                <option value="after-shower">After shower</option>
                <option value="before-work">Before work</option>
                <option value="before-bed">Before bed</option>
              </Select>
            </div>
          </div>
          <div className="rounded-3xl bg-[var(--primary-soft)] p-4 text-sm leading-6 text-[var(--primary)]">
            We keep this short on purpose. You only need enough detail to shape today&apos;s first tiny step.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/today" className="sm:flex-1">
              <Button fullWidth>Generate micro-plan</Button>
            </Link>
            <Link href="/login" className="sm:flex-1">
              <Button variant="ghost" fullWidth>
                Save later
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      <div className="grid gap-6">
        <OnboardingPreview values={mockOnboardingData} />
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Onboarding result</p>
              <h3 className="mt-2 text-xl font-semibold">A calmer first plan for today</h3>
            </div>
            <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              {decomposition.source === "openai" ? "AI live" : "Fallback mock"}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{decomposition.goalSummary}</p>

          <div className="mt-5 rounded-3xl bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Selected anchor</p>
            <p className="mt-2 font-medium">{decomposition.selectedAnchor}</p>
          </div>

          <div className="mt-4 rounded-3xl bg-[var(--primary-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Today action</p>
            <p className="mt-2 text-lg font-semibold">{decomposition.todayAction.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{decomposition.todayAction.reason}</p>
            <p className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-[var(--primary)]">
              {minutesLabel(decomposition.todayAction.durationMinutes)}
            </p>
            <p className="mt-3 text-sm text-[var(--primary)]">Fallback: {decomposition.fallbackAction}</p>
          </div>

          <div className="mt-4 space-y-4">
            {decomposition.microActions.map((action) => (
              <div key={action.title} className="rounded-3xl bg-white/70 p-4">
                <p className="font-medium">{action.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--primary)]">Fallback: {action.fallbackAction}</span>
                  <span className="text-[var(--muted)]">{minutesLabel(action.durationMinutes)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
