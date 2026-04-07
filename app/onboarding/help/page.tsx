import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

type OnboardingHelpPageProps = {
  searchParams?: Promise<{
    step?: string;
    review?: string;
    reselect?: string;
    resume?: string;
  }>;
};

function buildBackHref(params: { step?: string; review?: string; reselect?: string; resume?: string }) {
  const search = new URLSearchParams();

  if (params.step) {
    search.set("step", params.step);
  }

  if (params.resume === "1") {
    search.set("resume", "1");
  }

  if (params.review === "1") {
    search.set("review", "1");
  }

  if (params.reselect === "1") {
    search.set("reselect", "1");
  }

  const query = search.toString();
  return query ? `/onboarding?${query}` : "/onboarding";
}

export default async function OnboardingHelpPage({ searchParams }: OnboardingHelpPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();

  const steps =
    locale === "ko"
      ? [
          { title: "1. 목표 적기", body: "만들고 싶은 변화를 짧게 적어요." },
          { title: "2. 작은 행동 보기", body: "바로 할 수 있는 것만 보여줘요." },
          { title: "3. 하나 고르기", body: "지금 제일 쉬운 걸 고르면 돼요." },
          { title: "4. 루틴 붙이기", body: "이미 하는 루틴 뒤에 붙이면 시작 신호가 또렷해져요." },
          { title: "5. 마지막 확인", body: "오늘 할 행동만 정하면 끝이에요." },
        ]
      : [
          { title: "1. Name the goal", body: "Keep it short and clear." },
          { title: "2. Review options", body: "We only show tiny actions." },
          { title: "3. Pick one", body: "Choose the easiest helpful option." },
          { title: "4. Attach a cue", body: "Use something you already do." },
          { title: "5. Final check", body: "Pick today's step and start." },
        ];

  return (
    <PageShell auth={auth} locale={locale} path="/onboarding/help" title={locale === "ko" ? "도움말" : "Help"} description="" className="mx-auto max-w-3xl">
      <div className="grid gap-4">
        {steps.map((step) => (
          <Card key={step.title} className="bg-[var(--surface-strong)]">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">{step.body}</p>
          </Card>
        ))}
        <Card className="bg-[var(--surface-muted)]">
          <h2 className="text-lg font-semibold">{locale === "ko" ? "기억할 점" : "Remember"}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
            {locale === "ko" ? "완벽한 계획보다 오늘 바로 할 수 있는 한 걸음이 더 중요해요." : "A tiny start matters more than a perfect plan."}
          </p>
          <div className="mt-4">
            <Link href={buildBackHref(params) as any}>
              <Button>{locale === "ko" ? "온보딩으로" : "Back to onboarding"}</Button>
            </Link>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
