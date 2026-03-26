import Link from "next/link";

import { OnboardingPreview } from "@/components/habit/onboarding-preview";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { mockOnboardingData, mockPlan } from "@/lib/data/mock-habit";

export default function OnboardingPage() {
  return (
    <PageShell
      eyebrow="Onboarding"
      title="Let’s make the goal lighter."
      description="Answer a few short questions so the plan starts small enough to actually happen. This version uses mock data first, with validation-ready fields and placeholder AI service hooks."
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Mock AI output</p>
          <div className="mt-4 space-y-4">
            {mockPlan.map((action) => (
              <div key={action.title} className="rounded-3xl bg-white/70 p-4">
                <p className="font-medium">{action.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
                <p className="mt-2 text-sm text-[var(--primary)]">Fallback: {action.fallbackAction}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
