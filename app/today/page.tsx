import Link from "next/link";

import { getHabitSession } from "@/lib/habit-session";
import { ActionCard } from "@/components/today/action-card";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";
import { microActionSchema } from "@/lib/validators/habit";
import { getTodayStateFromSession } from "@/lib/supabase/demo-data";

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
  const todayState = await getTodayStateFromSession(session);

  if (!todayState) {
    return (
      <PageShell
        auth={auth}
        locale={locale}
        path="/today"
        eyebrow={locale === "ko" ? "오늘" : "Today"}
        title={locale === "ko" ? "오늘 할 일이 여기에 보여요." : "Your first tiny action will show up here."}
        description={
          locale === "ko"
            ? "플랜을 만들면 오늘 할 일이 보입니다."
            : "Once onboarding creates a plan, this screen will focus on just one concrete action for today."
        }
      >
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "아직 오늘 할 일이 없어요. 먼저 플랜을 만들어 주세요."
              : "There is no active daily action yet. Generate a micro-plan first, then today's step and fallback will appear here."}
          </p>
          <Link href="/onboarding" className="mt-5 inline-block">
            <Button>{locale === "ko" ? "온보딩 시작하기" : "Start onboarding"}</Button>
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
      eyebrow={locale === "ko" ? "오늘" : "Today"}
      title={locale === "ko" ? "오늘은 이 한 가지면 됩니다." : "One small action is enough for today."}
      description={
        locale === "ko"
          ? "오늘 할 것만 보여줍니다."
          : "This screen keeps the focus tight: one action, one fallback, one calm reminder that partial progress still counts."
      }
      className="grid gap-6 lg:grid-cols-[1fr_0.88fr]"
    >
      <div className="grid gap-6">
        {params.error ? (
          <Card className="border-amber-300 bg-amber-50/90">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{locale === "ko" ? "문제가 있어요" : "Action update issue"}</p>
            <p className="mt-3 text-sm leading-6 text-amber-900">{params.error}</p>
          </Card>
        ) : null}
        {isRecovered ? (
          <Card className="bg-[var(--primary-soft)] text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "더 작은 단계로 바꿨어요" : "Smaller step ready"}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {locale === "ko"
                ? "오늘은 더 작은 버전으로 갑니다."
                : "You adjusted the plan instead of forcing it. This lighter version is your new action for today."}
            </p>
          </Card>
        ) : null}
        {isCompleted ? (
          <Card className="border-emerald-300 bg-emerald-50/90 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{locale === "ko" ? "완료됨" : "Today's action completed"}</p>
            <p className="mt-3 text-sm leading-6 text-emerald-900">
              {locale === "ko"
                ? "오늘 할 일은 끝났어요."
                : "You completed today's tiny action. Returning gently matters more than doing it perfectly."}
            </p>
          </Card>
        ) : null}
        <ActionCard action={action} locale={locale} isCompleted={isCompleted} />
      </div>

      <div className="grid gap-6">
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "대체 행동" : "Fallback action"}</p>
          <p className="mt-3 text-2xl font-semibold leading-tight">{action.fallbackAction}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "버거우면 이것만 해도 괜찮아요."
              : "If the original step feels heavy, the fallback keeps the habit alive without turning the day into a test."}
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
