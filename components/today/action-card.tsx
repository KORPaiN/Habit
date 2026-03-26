import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { minutesLabel } from "@/lib/utils/habit";
import type { MicroAction } from "@/lib/validators/habit";
import { demoBackendIds } from "@/lib/utils/mock-habit";

type ActionCardProps = {
  action: MicroAction;
};

export function ActionCard({ action }: ActionCardProps) {
  return (
    <Card className="bg-[var(--card-strong)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Today&apos;s one action</p>
      <h2 className="mt-3 text-2xl font-semibold leading-tight">{action.title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
      <div className="mt-5 inline-flex rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary)]">
        {minutesLabel(action.durationMinutes)}
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/today" className="sm:flex-1">
          <Button fullWidth>
            Mark it done
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link
          href={{
            pathname: "/recover",
            query: {
              dailyActionId: demoBackendIds.dailyActionId,
              goalId: demoBackendIds.goalId,
              reason: "too_big",
            },
          }}
          className="sm:flex-1"
        >
          <Button variant="secondary" fullWidth>
            This feels too difficult
            <RotateCcw className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
