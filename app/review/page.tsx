import { PageShell } from "@/components/layout/page-shell";
import { StatPill } from "@/components/habit/stat-pill";
import { Card } from "@/components/ui/card";
import { mockWeeklySummary } from "@/lib/data/mock-habit";

export default function ReviewPage() {
  return (
    <PageShell
      eyebrow="Weekly review"
      title="Look for patterns, not proof."
      description="The weekly review is here to notice what made starting easier, where friction showed up, and what should become smaller next week."
      className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
    >
      <Card className="h-fit">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Week at a glance</p>
        <div className="mt-4 grid gap-3">
          <StatPill label="Completed days" value={`${mockWeeklySummary.completedDays} days`} />
          <StatPill label="Best streak" value={`${mockWeeklySummary.streakDays} days`} />
        </div>
      </Card>

      <div className="grid gap-6">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">What felt hard</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{mockWeeklySummary.difficultMoments}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">What helped</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{mockWeeklySummary.helpfulPattern}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Next adjustment</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{mockWeeklySummary.nextAdjustment}</p>
        </Card>
      </div>
    </PageShell>
  );
}
