import Link from "next/link";

import { ActionCard } from "@/components/today/action-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";
import { getHabitReviewStateFromSession, getTodayStateFromSession } from "@/lib/supabase/demo-data";
import { buildAnchorReminder } from "@/lib/utils/habit";
import { microActionSchema } from "@/lib/validators/habit";

type TodayPageProps = {
  searchParams?: Promise<{
    title?: string;
    reason?: string;
    duration?: string;
    fallback?: string;
    recovered?: string;
    completed?: string;
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const session = await getHabitSession();
  const [todayState, reviewState] = await Promise.all([getTodayStateFromSession(session), getHabitReviewStateFromSession(session)]);
  const recipeText = reviewState?.meta.recipeText;
  const celebrationText = reviewState?.meta.celebrationText;
  const anchorReminder = reviewState
    ? buildAnchorReminder(reviewState.meta.primaryAnchor, locale)
    : todayState
      ? `기존 습관: ${todayState.anchor}`
      : undefined;

  if (!todayState) {
    return (
      <PageShell auth={auth} locale={locale} path="/today" eyebrow="오늘" title="오늘 행동이 아직 없어요" description="온보딩을 마치면 바로 시작할 수 있어요.">
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">먼저 아주 작은 계획부터 만들어주세요.</p>
          <Link href="/onboarding" className="mt-5 inline-block">
            <Button>온보딩</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  const action =
    params.title && params.reason && params.duration && params.fallback
      ? microActionSchema.parse({
          title: params.title,
          reason: params.reason,
          durationMinutes: Number(params.duration),
          fallbackAction: params.fallback,
        })
      : todayState.action;

  const isRecovered = params.recovered === "1";
  const isCompleted = params.completed === "1" || todayState.status === "completed";

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/today"
      eyebrow="오늘"
      title="오늘은 하나면 충분해요"
      description="오늘 할 것은 하나만 보면 돼요."
      className="grid gap-6 lg:grid-cols-[1fr_0.88fr]"
    >
      <div className="grid gap-6">
        {params.error ? (
          <Card className="border-amber-300 bg-amber-50/90">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">문제</p>
            <p className="mt-3 text-sm leading-6 text-amber-900">{params.error}</p>
          </Card>
        ) : null}
        {isRecovered ? (
          <Card className="bg-[var(--primary-soft)] text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">복구 완료</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">오늘 맞는 버전으로 바꿨어요.</p>
          </Card>
        ) : null}
        <ActionCard
          action={action}
          locale={locale}
          isCompleted={isCompleted}
          recipeText={recipeText}
          anchorReminder={anchorReminder}
          celebrationText={celebrationText}
        />
      </div>

      <div className="grid gap-6">
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">대체 행동</p>
          <p className="mt-3 text-2xl font-semibold leading-tight">{action.fallbackAction}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">버겁다면 이것만 해도 충분해요.</p>
        </Card>
      </div>
    </PageShell>
  );
}
