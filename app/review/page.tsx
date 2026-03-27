import Link from "next/link";

import { getHabitSession } from "@/lib/habit-session";
import { PageShell } from "@/components/ui/page-shell";
import { StatPill } from "@/components/review/stat-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";
import { getMonthlyReviewStateFromSession } from "@/lib/supabase/demo-data";

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  searchParams?: Promise<{
    completed?: string;
    month?: string;
  }>;
};

function parseMonthParam(value?: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return new Date();
  }

  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return new Date();
  }

  return new Date(year, monthIndex, 1);
}

function formatMonthParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addMonths(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const session = await getHabitSession();
  const selectedMonth = parseMonthParam(params.month);
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const previousMonth = addMonths(selectedMonth, -1);
  const nextMonth = addMonths(selectedMonth, 1);
  const canGoNext = nextMonth <= currentMonth;
  const monthlySummary = await getMonthlyReviewStateFromSession(session, selectedMonth);

  if (!monthlySummary) {
    return (
      <PageShell
        auth={auth}
        locale={locale}
        path="/review"
        eyebrow={locale === "ko" ? "리뷰" : "Review"}
        title={locale === "ko" ? "리뷰는 조금 뒤에 보여드릴게요." : "Your review will appear once the week has data."}
        description={
          locale === "ko"
            ? "기록이 쌓이면 월간 흐름이 보입니다."
            : "The review is generated from real completions, failures, and skips instead of placeholder summaries."
        }
      >
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "아직 볼 리뷰가 없어요. 먼저 시작해 보세요."
              : "There is no active goal to review yet. Complete onboarding and mark actions done during the week to build your first summary."}
          </p>
          <Link href="/onboarding" className="mt-5 inline-block">
            <Button>{locale === "ko" ? "온보딩 시작하기" : "Start onboarding"}</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/review"
      eyebrow={locale === "ko" ? "리뷰" : "Review"}
      title={locale === "ko" ? `${monthlySummary.monthLabel} 흐름을 볼게요.` : "Look for patterns, not proof."}
      description={
        locale === "ko"
          ? "이번 달뿐 아니라 지난달 흐름도 볼 수 있어요."
          : "The weekly review is here to notice what made starting easier, where friction showed up, and what should become smaller next week."
      }
      className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
    >
      <Card className="h-fit bg-[var(--surface-muted)] text-center">
        {params.completed === "1" ? (
          <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--primary)]">
            {locale === "ko"
              ? "오늘 완료한 내용이 반영됐어요."
              : "Today's action was marked complete. The next review will catch up as weekly data is saved."}
          </div>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          {locale === "ko" ? `${monthlySummary.monthLabel} 한눈에 보기` : "Month at a glance"}
        </p>
        <div className="mt-4 grid gap-3 justify-items-center">
          <StatPill label={locale === "ko" ? "완료" : "Completed"} value={locale === "ko" ? `${monthlySummary.completedCount}회` : `${monthlySummary.completedCount}`} />
          <StatPill
            label={locale === "ko" ? "완료율" : "Completion rate"}
            value={locale === "ko" ? `${monthlySummary.completionRate}%` : `${monthlySummary.completionRate}%`}
          />
          <StatPill label={locale === "ko" ? "최고 연속" : "Best streak"} value={locale === "ko" ? `${monthlySummary.bestStreak}일` : `${monthlySummary.bestStreak} days`} />
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          {locale === "ko"
            ? `${monthlySummary.totalCount}번 중 ${monthlySummary.completedCount}번 완료했어요.`
            : `${monthlySummary.completedCount} completed out of ${monthlySummary.totalCount}.`}
        </p>
      </Card>

      <div className="grid gap-6">
        <Card className="bg-[var(--surface-strong)] text-center">
          <div className="flex items-center justify-center gap-3">
            <Link href={`/review?month=${formatMonthParam(previousMonth)}`}>
              <Button variant="ghost" size="sm">
                {locale === "ko" ? "이전 달" : "Previous"}
              </Button>
            </Link>
            {canGoNext ? (
              <Link href={`/review?month=${formatMonthParam(nextMonth)}`}>
                <Button variant="ghost" size="sm">
                  {locale === "ko" ? "다음 달" : "Next"}
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                {locale === "ko" ? "다음 달" : "Next"}
              </Button>
            )}
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            {locale === "ko" ? "달력으로 보기" : "Calendar"}
          </p>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {monthlySummary.calendar.map((entry) => {
              const tone =
                entry.status === "completed"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : entry.status === "failed"
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : entry.status === "skipped"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]";

              return (
                <div
                  key={entry.date}
                  className={`flex aspect-square items-center justify-center rounded-[var(--radius-md)] border text-sm font-medium ${tone}`}
                  title={`${entry.day}일`}
                >
                  {entry.day}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-[var(--muted)]">
            <span>완료</span>
            <span>실패</span>
            <span>건너뜀</span>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
