import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";

import { completeTodayAction } from "@/app/today/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/locale";
import { minutesLabel } from "@/lib/utils/habit";
import type { MicroAction } from "@/lib/validators/habit";

type ActionCardProps = {
  action: MicroAction;
  locale: Locale;
};

export function ActionCard({ action, locale }: ActionCardProps) {
  return (
    <Card className="bg-[var(--card-strong)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
        {locale === "ko" ? "오늘의 한 가지 행동" : "Today's one action"}
      </p>
      <h2 className="mt-3 text-2xl font-semibold leading-tight">{action.title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
      <div className="mt-5 inline-flex rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary)]">
        {minutesLabel(action.durationMinutes, locale)}
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <form action={completeTodayAction} className="sm:flex-1">
          <Button type="submit" fullWidth>
            {locale === "ko" ? "완료했어요" : "Mark it done"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
        <Link href="/recover?reason=too_big" className="sm:flex-1">
          <Button variant="secondary" fullWidth>
            {locale === "ko" ? "이건 아직 어렵게 느껴져요" : "This feels too difficult"}
            <RotateCcw className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
