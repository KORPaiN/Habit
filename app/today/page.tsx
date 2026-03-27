import Link from "next/link";

import { getHabitSession } from "@/lib/habit-session";
import { ActionCard } from "@/components/today/action-card";
import { StatPill } from "@/components/review/stat-pill";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { commonCopy } from "@/lib/copy";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";
import { minutesLabel } from "@/lib/utils/habit";
import { microActionSchema } from "@/lib/validators/habit";
import { getTodayStateFromSession } from "@/lib/supabase/demo-data";

type TodayPageProps = {
  searchParams?: Promise<{
    title?: string;
    reason?: string;
    duration?: string;
    fallback?: string;
    recovered?: string;
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const common = commonCopy[locale];
  const session = await getHabitSession();
  const todayState = await getTodayStateFromSession(session);

  if (!todayState) {
    return (
      <PageShell
        auth={auth}
        locale={locale}
        path="/today"
        eyebrow={locale === "ko" ? "오늘" : "Today"}
        title={locale === "ko" ? "첫 작은 행동이 여기에 표시됩니다." : "Your first tiny action will show up here."}
        description={
          locale === "ko"
            ? "온보딩에서 계획을 만들면 이 화면은 오늘의 구체적인 행동 하나에만 집중합니다."
            : "Once onboarding creates a plan, this screen will focus on just one concrete action for today."
        }
      >
        <Card className="bg-[var(--surface-strong)]">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "아직 활성화된 오늘의 행동이 없어요. 먼저 마이크로 플랜을 만든 뒤 오늘의 단계와 대체 행동을 확인할 수 있습니다."
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

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/today"
      eyebrow={locale === "ko" ? "오늘" : "Today"}
      title={locale === "ko" ? "오늘은 작은 행동 하나면 충분해요." : "One small action is enough for today."}
      description={
        locale === "ko"
          ? "이 화면은 한 가지 행동, 한 가지 대체 행동, 그리고 부분적인 진전도 충분하다는 차분한 메시지에만 집중합니다."
          : "This screen keeps the focus tight: one action, one fallback, one calm reminder that partial progress still counts."
      }
      className="grid gap-6 lg:grid-cols-[1fr_0.88fr]"
    >
      <div className="grid gap-6">
        {params.error ? (
          <Card className="border-amber-300 bg-amber-50/90">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{locale === "ko" ? "행동 업데이트 문제" : "Action update issue"}</p>
            <p className="mt-3 text-sm leading-6 text-amber-900">{params.error}</p>
          </Card>
        ) : null}
        {isRecovered ? (
          <Card className="bg-[var(--primary-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "더 작은 단계가 준비됐어요" : "Smaller step ready"}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {locale === "ko"
                ? "억지로 밀어붙이는 대신 계획을 조정했어요. 이 더 가벼운 버전이 오늘의 새 행동입니다."
                : "You adjusted the plan instead of forcing it. This lighter version is your new action for today."}
            </p>
          </Card>
        ) : null}
        <ActionCard action={action} locale={locale} />
      </div>

      <div className="grid gap-6">
        <Card className="bg-[var(--surface-muted)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "왜 이게 맞는지" : "Why this fits"}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatPill label={locale === "ko" ? "목표" : "Goal"} value={todayState.goal} />
            <StatPill label={locale === "ko" ? "시간" : "Time"} value={minutesLabel(action.durationMinutes, locale)} />
            <StatPill label={locale === "ko" ? "앵커" : "Anchor"} value={todayState.anchor} />
            <StatPill label={locale === "ko" ? "소스" : "Source"} value={todayState.source === "Supabase" ? common.sourceSupabase : common.sourceMock} />
          </div>
        </Card>

        <Card className="bg-[var(--surface-strong)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "대체 행동" : "Fallback action"}</p>
          <p className="mt-3 text-2xl font-semibold leading-tight">{action.fallbackAction}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "원래 단계가 버겁게 느껴질 때, 대체 행동은 오늘을 시험으로 만들지 않으면서도 습관의 흐름을 이어줍니다."
              : "If the original step feels heavy, the fallback keeps the habit alive without turning the day into a test."}
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
