import { ActionCard } from "@/components/today/action-card";
import { StatPill } from "@/components/review/stat-pill";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { mockOnboardingData, mockPlan } from "@/lib/utils/mock-habit";
import { buildAnchorLabel, minutesLabel } from "@/lib/utils/habit";
import { microActionSchema } from "@/lib/validators/habit";

type TodayPageProps = {
  searchParams?: Promise<{
    title?: string;
    reason?: string;
    duration?: string;
    fallback?: string;
    recovered?: string;
  }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = (await searchParams) ?? {};

  const action =
    params.title && params.reason && params.duration && params.fallback
      ? microActionSchema.parse({
          title: params.title,
          reason: params.reason,
          durationMinutes: Number(params.duration),
          fallbackAction: params.fallback,
        })
      : mockPlan[0];

  const isRecovered = params.recovered === "1";

  return (
    <PageShell
      eyebrow="Today"
      title="One small action is enough for today."
      description="This screen keeps the focus tight: one action, one fallback, one calm reminder that partial progress still counts."
      className="grid gap-6 lg:grid-cols-[1fr_0.85fr]"
    >
      <div className="grid gap-6">
        {isRecovered ? (
          <Card className="bg-[var(--primary-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Smaller step ready</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              You adjusted the plan instead of forcing it. This lighter version is your new action for today.
            </p>
          </Card>
        ) : null}
        <ActionCard action={action} />
      </div>

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
