import { PageShell } from "@/components/ui/page-shell";
import { StatPill } from "@/components/review/stat-pill";
import { Card } from "@/components/ui/card";
import { getDemoWeeklyReviewState, isSupabaseConfigured } from "@/lib/supabase/demo-data";

export default async function ReviewPage() {
  const weeklySummary = await getDemoWeeklyReviewState();

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
          <StatPill label="Completed days" value={`${weeklySummary.completedDays} days`} />
          <StatPill label="Best streak" value={`${weeklySummary.streakDays} days`} />
          <StatPill label="Source" value={isSupabaseConfigured() ? "Supabase" : "Mock"} />
        </div>
      </Card>

      <div className="grid gap-6">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">What felt hard</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{weeklySummary.difficultMoments}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">What helped</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{weeklySummary.helpfulPattern}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Next adjustment</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{weeklySummary.nextAdjustment}</p>
        </Card>
      </div>
    </PageShell>
  );
}
