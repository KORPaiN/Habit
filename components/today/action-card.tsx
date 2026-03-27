import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";

import { completeTodayAction } from "@/app/today/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/locale";
import type { MicroAction } from "@/lib/validators/habit";

type ActionCardProps = {
  action: MicroAction;
  locale: Locale;
  isCompleted?: boolean;
};

export function ActionCard({ action, locale, isCompleted = false }: ActionCardProps) {
  return (
    <Card className="bg-[var(--surface-strong)] px-5 py-6 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
        {locale === "ko" ? "오늘의 한 가지 행동" : "Today's one action"}
      </p>
      {isCompleted ? (
        <div className="mt-4 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {locale === "ko" ? "완료됨" : "Completed"}
        </div>
      ) : null}
      <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight sm:text-[1.75rem]">{action.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-soft)]">{action.reason}</p>
      <div className="mt-6 rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] p-3.5">
        <p className="text-sm leading-6 text-[var(--foreground-soft)]">
          {locale === "ko"
            ? "잘하는 것보다 시작하는 게 더 중요해요."
            : "The goal is not to do it perfectly, only to make starting feel possible today."}
        </p>
      </div>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <form action={completeTodayAction} className="sm:flex-1">
          <Button type="submit" fullWidth size="lg" disabled={isCompleted}>
            {isCompleted ? (locale === "ko" ? "완료됨" : "Completed") : locale === "ko" ? "완료했어요" : "Mark it done"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
        <Link href="/recover?reason=too_big" className="sm:flex-1">
          <Button variant="secondary" fullWidth size="lg">
            {locale === "ko" ? "더 작게 바꿀래요" : "This feels too difficult"}
            <RotateCcw className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
