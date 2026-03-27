import Link from "next/link";

import { RecoveryFlow } from "@/components/today/recovery-flow";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRecoveryPageState } from "@/app/recover/actions";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

type RecoveryPageProps = {
  searchParams?: Promise<{
    reason?: "too_big" | "too_tired" | "forgot" | "schedule_conflict" | "low_motivation" | "other";
  }>;
};

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  const state = await getRecoveryPageState();
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();

  if (!state) {
    return (
      <PageShell
        auth={auth}
        locale={locale}
        path="/recover"
        eyebrow={locale === "ko" ? "리커버리" : "Recovery"}
        title={locale === "ko" ? "먼저 첫 계획이 필요해요." : "Create a first plan before shrinking it."}
        description={locale === "ko" ? "지금 줄일 행동이 없어요." : "Recovery only works once there is a current action to redesign."}
      >
        <Card>
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "먼저 작은 행동을 만든 뒤 다시 와 주세요."
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
      auth={auth}
      locale={locale}
      path="/recover"
      eyebrow={locale === "ko" ? "리커버리" : "Recovery"}
      title={locale === "ko" ? "오늘은 더 작게 바꿔볼게요." : "A hard day means we redesign the step."}
      description={
        locale === "ko"
          ? "버거우면 더 작은 버전으로 바꾸면 됩니다."
          : "If today's action felt too big, we can make it smaller right away. You only need one version that feels possible."
      }
    >
      <RecoveryFlow currentAction={state.currentAction} goal={state.goal} initialReason={params.reason} locale={locale} />
    </PageShell>
  );
}
