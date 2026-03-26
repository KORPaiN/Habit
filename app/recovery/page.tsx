import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockPlan } from "@/lib/data/mock-habit";
import { shrinkAction } from "@/lib/habit";

export default function RecoveryPage() {
  const originalAction = mockPlan[0];
  const smallerAction = shrinkAction(originalAction);

  return (
    <PageShell
      eyebrow="Recovery"
      title="Missing the step is information, not failure."
      description="When today’s action felt too big, we redesign the step instead of asking for more force."
      className="grid gap-6 lg:grid-cols-2"
    >
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Original action</p>
        <h2 className="mt-3 text-2xl font-semibold">{originalAction.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{originalAction.reason}</p>
      </Card>

      <Card className="bg-[var(--danger-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">Smaller version</p>
        <h2 className="mt-3 text-2xl font-semibold">{smallerAction.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{smallerAction.reason}</p>
        <div className="mt-6 rounded-3xl bg-white/70 p-4">
          <p className="text-sm font-medium">Fallback action</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{smallerAction.fallbackAction}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/today" className="sm:flex-1">
            <Button fullWidth>Try this version</Button>
          </Link>
          <Link href="/review" className="sm:flex-1">
            <Button variant="ghost" fullWidth>
              See weekly pattern
            </Button>
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
