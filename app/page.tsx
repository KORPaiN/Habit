import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageShell } from "@/components/ui/page-shell";
import { StatPill } from "@/components/review/stat-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const auth = await getAuthShellState();
  const locale = auth.isAuthenticated ? await getLocale() : "ko";
  const steps =
    locale === "ko"
      ? ["목표를 적어요.", "오늘 할 한 가지를 고릅니다.", "버거우면 더 줄입니다."]
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
      title={locale === "ko" ? "작게 시작하면 됩니다." : "Start smaller than your resistance."}
      description={
        locale === "ko"
          ? "큰 목표를 오늘 할 수 있는 작은 행동으로 바꿉니다."
          : "Habit turns a heavy goal into one calm, concrete step you can finish in a few minutes. No shame, no giant streak pressure, just a lighter way to begin."
      }
      className="grid gap-6"
    >
      <Card className="relative overflow-hidden border-white/65 bg-[var(--surface-strong)] px-6 py-7 sm:px-8 sm:py-8">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-[color:var(--accent-soft)] via-transparent to-[color:var(--primary-soft)]" />
        <div className="absolute -right-16 top-12 h-44 w-44 rounded-full bg-[color:var(--primary-soft)]/80 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap gap-3">
            <StatPill label={locale === "ko" ? "집중" : "Focus"} value={locale === "ko" ? "한 가지" : "One action"} />
            <StatPill label={locale === "ko" ? "시간" : "Time"} value={locale === "ko" ? "1~5분" : "1 to 5 minutes"} />
            <StatPill label={locale === "ko" ? "다시 조정" : "Recovery"} value={locale === "ko" ? "더 작게" : "Make it smaller"} />
          </div>
          <div className="mt-9 max-w-3xl">
            <p className="text-sm font-medium text-[var(--primary)]">
              {locale === "ko" ? "오늘은 한 단계면 충분해요." : "You do not need a whole new life plan today."}
            </p>
          </div>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-balance sm:text-5xl">
            {locale === "ko" ? "시작이 어려운 사람을 위한 습관 앱" : "A habit app for people who freeze at the starting line."}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--foreground-soft)]">
            {locale === "ko"
              ? "목표를 정하고, 작은 계획을 만들고, 오늘 할 한 가지만 실행합니다."
              : "This MVP is built around tiny execution loops: choose a goal, set a realistic window, receive a micro-plan, then return each day for one doable step."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/onboarding">
              <Button size="lg">
                {locale === "ko" ? "첫 계획 만들기" : "Start your first plan"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost" size="lg">
                {locale === "ko" ? "계정 만들기" : "Create account"}
              </Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[var(--radius-md)] border border-white/60 bg-white/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
                  {locale === "ko" ? `${index + 1}단계` : `Step ${index + 1}`}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
