import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export default async function OnboardingHelpPage() {
  const locale = await getLocale();
  const auth = await getAuthShellState();

  const steps =
    locale === "ko"
      ? [
          {
            title: "1. 목표를 적어요",
            body: "지금 당장 시작하고 싶은 목표를 짧게 적으면 됩니다. 완벽하게 설명하지 않아도 괜찮아요.",
          },
          {
            title: "2. 부담 정도를 고릅니다",
            body: "쉬움, 보통, 어려움 중 현재 느낌에 가까운 것을 고르면 AI가 행동 크기를 더 작게 조절합니다.",
          },
          {
            title: "3. 앵커 행동을 적어요",
            body: "예를 들면 '아침에 커피를 마신 직후'처럼, 습관을 바로 이어서 시작할 타이밍을 적습니다.",
          },
          {
            title: "4. 마이크로 플랜을 만듭니다",
            body: "입력한 내용을 바탕으로 오늘 할 수 있는 아주 작은 행동과 대체 행동을 생성합니다.",
          },
        ]
      : [
          {
            title: "1. Name the goal",
            body: "Keep it short. You do not need a perfect description, only the goal you want help starting.",
          },
          {
            title: "2. Choose the difficulty",
            body: "Pick the option that matches how heavy the goal feels right now so the plan can shrink appropriately.",
          },
          {
            title: "3. Add an anchor",
            body: "Use a cue like 'right after my morning coffee' so the habit has a natural starting moment.",
          },
          {
            title: "4. Generate the plan",
            body: "We turn your input into one very small action for today and a fallback for harder days.",
          },
        ];

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding/help"
      title={locale === "ko" ? "온보딩은 이렇게 사용합니다." : "How onboarding works"}
      description=""
      className="mx-auto max-w-3xl"
    >
      <div className="grid gap-4">
        {steps.map((step) => (
          <Card key={step.title} className="bg-[var(--surface-strong)]">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">{step.body}</p>
          </Card>
        ))}
        <Card className="bg-[var(--surface-muted)]">
          <h2 className="text-lg font-semibold">{locale === "ko" ? "기억하면 좋은 점" : "A good rule of thumb"}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
            {locale === "ko"
              ? "온보딩의 목적은 큰 계획을 세우는 것이 아니라, 오늘 시작할 수 있는 가장 작은 행동을 찾는 것입니다."
              : "The goal of onboarding is not to build a full system, only to find the smallest step you can start today."}
          </p>
          <div className="mt-4">
            <Link href="/onboarding">
              <Button>{locale === "ko" ? "온보딩으로 돌아가기" : "Back to onboarding"}</Button>
            </Link>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
