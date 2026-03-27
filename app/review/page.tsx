import Link from "next/link";

import { getHabitSession } from "@/lib/habit-session";
import { PageShell } from "@/components/ui/page-shell";
import { StatPill } from "@/components/review/stat-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { commonCopy } from "@/lib/copy";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";
import { getWeeklyReviewStateFromSession } from "@/lib/supabase/demo-data";

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  searchParams?: Promise<{
    completed?: string;
  }>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const common = commonCopy[locale];
  const session = await getHabitSession();
  const weeklySummary = await getWeeklyReviewStateFromSession(session);

  if (!weeklySummary) {
    return (
      <PageShell
        auth={auth}
        locale={locale}
        path="/review"
        eyebrow={locale === "ko" ? "주간 리뷰" : "Weekly review"}
        title={locale === "ko" ? "주간 데이터가 쌓이면 리뷰가 표시됩니다." : "Your review will appear once the week has data."}
        description={
          locale === "ko"
            ? "리뷰는 플레이스홀더 요약이 아니라 실제 완료, 실패, 건너뜀 데이터를 바탕으로 생성됩니다."
            : "The review is generated from real completions, failures, and skips instead of placeholder summaries."
        }
      >
        <Card className="bg-[var(--surface-strong)]">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "아직 리뷰할 활성 목표가 없어요. 온보딩을 완료하고 주중에 행동을 수행하면 첫 요약이 만들어집니다."
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
      eyebrow={locale === "ko" ? "주간 리뷰" : "Weekly review"}
      title={locale === "ko" ? "증명이 아니라 패턴을 보세요." : "Look for patterns, not proof."}
      description={
        locale === "ko"
          ? "주간 리뷰는 무엇이 시작을 쉽게 만들었는지, 어디에서 마찰이 생겼는지, 다음 주에는 무엇을 더 작게 만들어야 하는지 살피기 위한 화면입니다."
          : "The weekly review is here to notice what made starting easier, where friction showed up, and what should become smaller next week."
      }
      className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
    >
      <Card className="h-fit bg-[var(--surface-muted)]">
        {params.completed === "1" ? (
          <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--primary)]">
            {locale === "ko"
              ? "오늘의 행동을 완료로 표시했어요. 주간 데이터가 저장되면 다음 리뷰에 반영됩니다."
              : "Today's action was marked complete. The next review will catch up as weekly data is saved."}
          </div>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "이번 주 한눈에 보기" : "Week at a glance"}</p>
        <div className="mt-4 grid gap-3">
          <StatPill label={locale === "ko" ? "완료한 날" : "Completed days"} value={locale === "ko" ? `${weeklySummary.completedDays}일` : `${weeklySummary.completedDays} days`} />
          <StatPill label={locale === "ko" ? "최고 연속" : "Best streak"} value={locale === "ko" ? `${weeklySummary.streakDays}일` : `${weeklySummary.streakDays} days`} />
          <StatPill label={locale === "ko" ? "소스" : "Source"} value={weeklySummary.source === "Supabase" ? common.sourceSupabase : common.sourceMock} />
        </div>
      </Card>

      <div className="grid gap-6">
        <Card className="bg-[var(--surface-strong)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "어떤 점이 어려웠는지" : "What felt hard"}</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{weeklySummary.difficultMoments}</p>
        </Card>
        <Card className="bg-[var(--surface-strong)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "무엇이 도움이 됐는지" : "What helped"}</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{weeklySummary.helpfulPattern}</p>
        </Card>
        <Card className="bg-[var(--surface-strong)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "다음 조정" : "Next adjustment"}</p>
          <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{weeklySummary.nextAdjustment}</p>
        </Card>
      </div>
    </PageShell>
  );
}
