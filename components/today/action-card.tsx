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
  recipeText?: string;
  anchorReminder?: string;
  celebrationText?: string;
};

export function ActionCard({
  action,
  locale,
  isCompleted = false,
  recipeText,
  anchorReminder,
  celebrationText,
}: ActionCardProps) {
  return (
    <Card className="bg-[var(--surface-strong)] px-5 py-6 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">오늘 행동</p>
      {recipeText ? <p className="mt-3 text-sm text-[var(--muted)]">{recipeText}</p> : null}
      {anchorReminder ? (
        <div className="mt-4 rounded-full bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--foreground-soft)]">{anchorReminder}</div>
      ) : null}
      {isCompleted ? (
        <div className="mt-4 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          완료
        </div>
      ) : null}
      <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight sm:text-[1.75rem]">{action.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-soft)]">{action.reason}</p>
      {isCompleted && celebrationText ? (
        <div className="mt-6 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 p-4 text-lg font-semibold text-emerald-800">
          {celebrationText}
        </div>
      ) : (
        <div className="mt-6 rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] p-3.5">
          <p className="text-sm leading-6 text-[var(--foreground-soft)]">
            {locale === "ko" ? "완벽하게보다 시작하기 쉽게." : "The goal is to make starting feel possible today."}
          </p>
        </div>
      )}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <form action={completeTodayAction} className="sm:flex-1">
          <Button type="submit" fullWidth size="lg" disabled={isCompleted}>
            {isCompleted ? "완료" : "해냈어요"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
        <Link href="/recover?reason=too_big" className="sm:flex-1">
          <Button variant="secondary" fullWidth size="lg">
            더 작게
            <RotateCcw className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
