import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { PageShell } from "@/components/ui/page-shell";
import { StatPill } from "@/components/review/stat-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const steps =
    locale === "ko"
      ? [
          "중요하지만 시작이 어려운 목표를 하나 정하세요.",
          "인생 계획이 아니라 오늘 할 수 있는 아주 작은 행동 하나를 받으세요.",
          "오늘 놓쳤다면 처음부터 다시가 아니라 더 작게 줄이세요.",
        ]
      : [
          "Name a goal that feels important but hard to start.",
          "Get one tiny action for today, not a full plan for life.",
          "If today misses, shrink the action instead of starting over.",
        ];

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/"
      eyebrow={locale === "ko" ? "마이크로 습관 코치" : "Micro-habit coach"}
      title={locale === "ko" ? "저항보다 더 작게 시작하세요." : "Start smaller than your resistance."}
      description={
        locale === "ko"
          ? "Habit은 무거운 목표를 몇 분 안에 끝낼 수 있는 차분하고 구체적인 한 단계로 바꿉니다. 죄책감도, 거대한 연속 기록 압박도 없이 더 가볍게 시작할 수 있게 돕습니다."
          : "Habit turns a heavy goal into one calm, concrete step you can finish in a few minutes. No shame, no giant streak pressure, just a lighter way to begin."
      }
      className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
    >
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-200/40 via-transparent to-emerald-200/40" />
        <div className="relative">
          <div className="flex flex-wrap gap-3">
            <StatPill label={locale === "ko" ? "집중" : "Focus"} value={locale === "ko" ? "한 가지 행동" : "One action"} />
            <StatPill label={locale === "ko" ? "시간" : "Time"} value={locale === "ko" ? "1~5분" : "1 to 5 minutes"} />
            <StatPill label={locale === "ko" ? "리커버리" : "Recovery"} value={locale === "ko" ? "더 작게 줄이기" : "Make it smaller"} />
          </div>
          <h2 className="mt-8 max-w-2xl text-4xl font-semibold leading-tight text-balance">
            {locale === "ko" ? "시작선 앞에서 멈춰버리는 사람들을 위한 습관 앱." : "A habit app for people who freeze at the starting line."}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
            {locale === "ko"
              ? "이 MVP는 작은 실행 루프를 중심으로 만들어졌습니다. 목표를 정하고, 현실적인 시간을 정하고, 마이크로 플랜을 받은 뒤 매일 돌아와 해낼 수 있는 한 단계를 수행합니다."
              : "This MVP is built around tiny execution loops: choose a goal, set a realistic window, receive a micro-plan, then return each day for one doable step."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/onboarding">
              <Button>
                {locale === "ko" ? "첫 계획 시작하기" : "Start your first plan"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost">{locale === "ko" ? "계정 만들기" : "Create account"}</Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-3xl bg-white/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  {locale === "ko" ? `${index + 1}단계` : `Step ${index + 1}`}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6">
        <Card className="bg-emerald-950 text-white">
          <Sparkles className="h-5 w-5 text-amber-300" />
          <h3 className="mt-4 text-2xl font-semibold">{locale === "ko" ? "압박을 낮추도록 설계" : "Designed to lower pressure"}</h3>
          <p className="mt-3 text-sm leading-6 text-emerald-50/80">
            {locale === "ko"
              ? "차분한 문구, 화면마다 하나의 주요 행동, 힘든 날을 위한 대체 경로를 담았습니다."
              : "Calm copy, one primary action per screen, and a fallback path for rough days."}
          </p>
        </Card>

        <Card>
          <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
          <h3 className="mt-4 text-xl font-semibold">{locale === "ko" ? "현재 스캐폴드 포함 항목" : "Included in this scaffold"}</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <li>{locale === "ko" ? "랜딩 및 인증 화면" : "Landing and auth screens"}</li>
            <li>{locale === "ko" ? "AI 기반 온보딩 흐름" : "Onboarding flow with live AI plan generation"}</li>
            <li>{locale === "ko" ? "오늘, 리커버리, 주간 리뷰 화면" : "Today, recovery, and weekly review pages"}</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
