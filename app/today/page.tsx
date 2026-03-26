import { ActionCard } from "@/components/habit/action-card";
import { StatPill } from "@/components/habit/stat-pill";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { mockOnboardingData, mockPlan } from "@/lib/data/mock-habit";
import { buildAnchorLabel, minutesLabel } from "@/lib/habit";

export default function TodayPage() {
  const action = mockPlan[0];

  return (
    <PageShell
      eyebrow="Today"
      title="One small action is enough for today."
      description="This screen keeps the focus tight: one action, one fallback, one calm reminder that partial progress still counts."
      className="grid gap-6 lg:grid-cols-[1fr_0.85fr]"
    >
      <ActionCard action={action} />

      <div className="grid gap-6">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Why this fits</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatPill label="Goal" value={mockOnboardingData.goal} />
            <StatPill label="Time" value={minutesLabel(action.durationMinutes)} />
            <StatPill label="Anchor" value={buildAnchorLabel(mockOnboardingData.anchor)} />
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Fallback action</p>
          <p className="mt-3 text-lg font-semibold">{action.fallbackAction}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            If the original step feels heavy, the fallback keeps the habit alive without turning the day into a test.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
