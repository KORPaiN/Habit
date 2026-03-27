import Link from "next/link";

import { RecoveryFlow } from "@/components/today/recovery-flow";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRecoveryPageState } from "@/app/recover/actions";
import { getLocale } from "@/lib/locale";

type RecoveryPageProps = {
  searchParams?: Promise<{
    reason?: "too_big" | "too_tired" | "forgot" | "schedule_conflict" | "low_motivation" | "other";
  }>;
};

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  const state = await getRecoveryPageState();
  const params = (await searchParams) ?? {};
  const locale = await getLocale();

  if (!state) {
    return (
      <PageShell
        locale={locale}
        path="/recover"
        eyebrow={locale === "ko" ? "리커버리" : "Recovery"}
        title={locale === "ko" ? "줄이기 전에 먼저 첫 계획이 필요해요." : "Create a first plan before shrinking it."}
        description={locale === "ko" ? "리커버리는 현재 행동이 있어야 다시 설계할 수 있습니다." : "Recovery only works once there is a current action to redesign."}
      >
        <Card>
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "먼저 온보딩에서 아주 작은 행동을 만들고, 필요할 때 이 화면에서 더 작게 줄일 수 있어요."
              : "Start with onboarding, generate a tiny action, and then this screen can make it even smaller when needed."}
          </p>
          <Link href="/onboarding" className="mt-5 inline-block">
            <Button>{locale === "ko" ? "온보딩으로 이동" : "Go to onboarding"}</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      locale={locale}
      path="/recover"
      eyebrow={locale === "ko" ? "리커버리" : "Recovery"}
      title={locale === "ko" ? "힘든 날에는 단계를 다시 설계하면 됩니다." : "A hard day means we redesign the step."}
      description={
        locale === "ko"
          ? "오늘의 행동이 너무 크게 느껴졌다면 바로 더 작게 만들 수 있어요. 가능한 버전 하나면 충분합니다."
          : "If today's action felt too big, we can make it smaller right away. You only need one version that feels possible."
      }
    >
      <RecoveryFlow currentAction={state.currentAction} goal={state.goal} initialReason={params.reason} locale={locale} />
    </PageShell>
  );
}
