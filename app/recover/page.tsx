import Link from "next/link";

import { getRecoveryPageState } from "@/app/recover/actions";
import { RecoveryFlow } from "@/components/today/recovery-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

type RecoveryPageProps = {
  searchParams?: Promise<{
    reason?: "too_big" | "forgot" | "forgot_often" | "not_wanted";
  }>;
};

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  const state = await getRecoveryPageState();
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();

  if (!state) {
    return (
      <PageShell auth={auth} locale={locale} path="/recover" eyebrow="복구" title="먼저 계획이 필요해요" description="오늘 행동이 있어야 복구할 수 있어요.">
        <Card className="text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">온보딩에서 아주 작은 계획을 먼저 만들어 주세요.</p>
          <Link href="/onboarding" className="mt-5 inline-block">
            <Button>온보딩</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell auth={auth} locale={locale} path="/recover" eyebrow="복구" title="어려우면 다시 줄여요" description="오늘 맞는 버전으로 바꾸면 됩니다.">
      <RecoveryFlow currentAction={state.currentAction} goal={state.goal} initialReason={params.reason} locale={locale} reviewMeta={state.reviewMeta} />
    </PageShell>
  );
}
