import Link from "next/link";

import { submitOnboarding } from "@/app/onboarding/actions";
import { OnboardingPreview } from "@/components/onboarding/onboarding-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { generateHabitDecomposition } from "@/lib/ai";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";
import { minutesLabel } from "@/lib/utils/habit";
import { mockOnboardingData } from "@/lib/utils/mock-habit";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const decomposition = await generateHabitDecomposition(mockOnboardingData, { locale });

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding"
      eyebrow={locale === "ko" ? "온보딩" : "Onboarding"}
      title={locale === "ko" ? "목표를 더 가볍게 만들어볼게요." : "Let's make the goal lighter."}
      description={
        locale === "ko"
          ? "몇 가지 짧은 질문만 답하면 실제로 시작 가능한 만큼 작은 계획으로 줄여드려요. 아래 미리보기는 저장할 때와 같은 서버 흐름으로 생성됩니다."
          : "Answer a few short questions so the plan starts small enough to actually happen. The preview below is generated through the same server-side decomposition flow used when the plan is saved."
      }
      className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
    >
      <Card>
        <form action={submitOnboarding} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {locale === "ko" ? "어떤 목표를 시작하는 데 도움이 필요하신가요?" : "What goal do you want help starting?"}
            </label>
            <Input
              name="goal"
              defaultValue={mockOnboardingData.goal}
              placeholder={locale === "ko" ? "예: 독서 습관 만들기" : "Example: build a reading habit"}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "가능한 시간(분)" : "Available minutes"}</label>
              <Input name="availableMinutes" defaultValue={String(mockOnboardingData.availableMinutes)} type="number" min={1} max={30} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "체감 난이도" : "Perceived difficulty"}</label>
              <Select name="difficulty" defaultValue={mockOnboardingData.difficulty}>
                <option value="gentle">{locale === "ko" ? "가벼움" : "Gentle"}</option>
                <option value="steady">{locale === "ko" ? "보통" : "Steady"}</option>
                <option value="hard">{locale === "ko" ? "어려움" : "Hard"}</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "선호 시간대" : "Preferred time"}</label>
              <Select name="preferredTime" defaultValue={mockOnboardingData.preferredTime}>
                <option value="morning">{locale === "ko" ? "아침" : "Morning"}</option>
                <option value="afternoon">{locale === "ko" ? "오후" : "Afternoon"}</option>
                <option value="evening">{locale === "ko" ? "저녁" : "Evening"}</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "앵커" : "Anchor"}</label>
              <Select name="anchor" defaultValue={mockOnboardingData.anchor}>
                <option value="after-coffee">{locale === "ko" ? "커피 마신 뒤" : "After coffee"}</option>
                <option value="after-shower">{locale === "ko" ? "샤워 후" : "After shower"}</option>
                <option value="before-work">{locale === "ko" ? "일 시작 전" : "Before work"}</option>
                <option value="before-bed">{locale === "ko" ? "잠들기 전" : "Before bed"}</option>
              </Select>
            </div>
          </div>
          <div className="rounded-3xl bg-[var(--primary-soft)] p-4 text-sm leading-6 text-[var(--primary)]">
            {locale === "ko"
              ? "질문은 짧게 유지합니다. 오늘의 첫 한 걸음을 만들 정도의 정보면 충분해요."
              : "We keep this short on purpose. You only need enough detail to shape today's first tiny step."}
          </div>
          {params.error ? (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {params.error}
            </div>
          ) : null}
          {!auth.isAuthenticated ? (
            <div className="rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              {locale === "ko"
                ? "계획을 실제로 저장하려면 먼저 Google로 로그인해야 합니다."
                : "Sign in with Google first to save this plan to your account."}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" fullWidth className="sm:flex-1">
              {locale === "ko" ? "마이크로 플랜 만들기" : "Generate micro-plan"}
            </Button>
            <Link href="/login" className="sm:flex-1">
              <Button variant="ghost" fullWidth>
                {locale === "ko" ? "Google 로그인" : "Sign in with Google"}
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      <div className="grid gap-6">
        <OnboardingPreview values={mockOnboardingData} locale={locale} />
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "온보딩 결과" : "Onboarding result"}</p>
              <h3 className="mt-2 text-xl font-semibold">{locale === "ko" ? "오늘을 위한 더 차분한 첫 계획" : "A calmer first plan for today"}</h3>
            </div>
            <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              {decomposition.source === "openai" ? (locale === "ko" ? "실시간 AI" : "AI live") : locale === "ko" ? "대체 플랜" : "Fallback plan"}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{decomposition.goalSummary}</p>

          <div className="mt-5 rounded-3xl bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">{locale === "ko" ? "선택된 앵커" : "Selected anchor"}</p>
            <p className="mt-2 font-medium">{decomposition.selectedAnchor}</p>
          </div>

          <div className="mt-4 rounded-3xl bg-[var(--primary-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">{locale === "ko" ? "오늘 행동" : "Today action"}</p>
            <p className="mt-2 text-lg font-semibold">{decomposition.todayAction.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{decomposition.todayAction.reason}</p>
            <p className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-[var(--primary)]">
              {minutesLabel(decomposition.todayAction.durationMinutes, locale)}
            </p>
            <p className="mt-3 text-sm text-[var(--primary)]">{locale === "ko" ? "대체 행동" : "Fallback"}: {decomposition.fallbackAction}</p>
          </div>

          <div className="mt-4 space-y-4">
            {decomposition.microActions.map((action) => (
              <div key={action.title} className="rounded-3xl bg-white/70 p-4">
                <p className="font-medium">{action.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--primary)]">{locale === "ko" ? "대체 행동" : "Fallback"}: {action.fallbackAction}</span>
                  <span className="text-[var(--muted)]">{minutesLabel(action.durationMinutes, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
