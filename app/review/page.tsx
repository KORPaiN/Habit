import Link from "next/link";

import { MonthPicker } from "@/components/review/month-picker";
import { StatPill } from "@/components/review/stat-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getHabitSession } from "@/lib/habit-session";
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

const WEEKDAY_LABELS = {
  ko: ["월", "화", "수", "목", "금", "토", "일"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
} as const;

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
      <PageShell auth={auth} locale={locale} path="/review" eyebrow={locale === "ko" ? "리뷰" : "Review"} title={locale === "ko" ? "아직 볼 리뷰가 없어요." : "No review yet."} description={locale === "ko" ? "먼저 온보딩을 마치고 오늘 행동을 만들어보세요." : "Finish onboarding and create today's action first."}>
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "저장된 행동이 생기면 여기서 바로 흐름을 볼 수 있어요."
              : "Your review will appear here once the first saved action exists."}
          </p>
          <Link href="/onboarding" className="mt-5 inline-block">
            <Button>{locale === "ko" ? "온보딩 시작" : "Start onboarding"}</Button>
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
      title={locale === "ko" ? `${monthlySummary.monthLabel} 흐름 보기` : "Look for patterns, not proof."}
      description={
        locale === "ko"
          ? "완벽함보다 어떤 날이 쉬웠는지 보는 화면이에요."
          : "Notice what made starting easier, where friction showed up, and what should become smaller."
      }
      className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
    >
      <Card className="h-fit bg-[var(--surface-muted)] text-center">
        {params.completed === "1" ? (
          <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--primary)]">
            {locale === "ko" ? "오늘 완료가 반영됐어요." : "Today's completion was saved."}
          </div>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          {locale === "ko" ? "이번 달 한눈에" : "Month at a glance"}
        </p>
        <div className="mt-4 grid gap-3 justify-items-center">
          <StatPill label={locale === "ko" ? "완료" : "Completed"} value={locale === "ko" ? `${monthlySummary.completedCount}번` : `${monthlySummary.completedCount}`} />
          <StatPill label={locale === "ko" ? "완료율" : "Completion rate"} value={`${monthlySummary.completionRate}%`} />
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
          <MonthPicker
            locale={locale}
            currentYear={currentMonth.getFullYear()}
            currentMonth={currentMonth.getMonth()}
            selectedYear={selectedMonth.getFullYear()}
            selectedMonth={selectedMonth.getMonth()}
            previousHref={`/review?month=${formatMonthParam(previousMonth)}`}
            nextHref={canGoNext ? `/review?month=${formatMonthParam(nextMonth)}` : undefined}
          />
          <div className="mt-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {locale === "ko" ? "달력" : "Calendar"}
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{monthlySummary.monthLabel}</p>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS[locale].map((label) => (
              <div key={label} className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-strong)]">
                {label}
              </div>
            ))}
          </div>
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
                  className={`flex aspect-square flex-col items-center justify-center rounded-[var(--radius-md)] border px-1 text-sm font-medium ${tone}`}
                  title={locale === "ko" ? `${entry.day}일 · 완료 ${entry.completedCount}개` : `${entry.day}, ${entry.completedCount} completed`}
                >
                  <span>{entry.day}</span>
                  {entry.completedCount > 0 ? <span className="mt-1 text-[10px] font-semibold leading-none">{locale === "ko" ? `${entry.completedCount}개` : `${entry.completedCount}`}</span> : null}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-[var(--muted)]">
            {locale === "ko" ? "숫자는 그날 완료한 행동 개수예요." : "The number shows how many actions you completed that day."}
          </p>
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
