import Link from "next/link";

import { PlanReviewForm } from "@/components/onboarding/plan-review-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser, getAuthShellState } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { PlanMicroActionInput } from "@/lib/validators/backend";
import type { Database } from "@/types";

type ReviewPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId || !session.planId) {
    return (
      <PageShell auth={auth} locale={locale} path="/onboarding/review" title="" description="" className="mx-auto max-w-3xl">
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">
            {locale === "ko" ? "검토할 플랜이 아직 없어요. 먼저 온보딩을 완료해 주세요." : "There is no plan to review yet. Complete onboarding first."}
          </p>
          <Link href="/onboarding" className="mt-4 inline-block">
            <Button>{locale === "ko" ? "온보딩으로" : "Back to onboarding"}</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  const client = await getSupabaseServerClient();
  const { data, error } = await client
    .from("micro_actions")
    .select("position, title, details, duration_minutes, fallback_title, fallback_details, fallback_duration_minutes")
    .eq("plan_id", session.planId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const microActions = (data ?? []) as Array<
    Pick<
      Database["public"]["Tables"]["micro_actions"]["Row"],
      "position" | "title" | "details" | "duration_minutes" | "fallback_title" | "fallback_details" | "fallback_duration_minutes"
    >
  >;

  const initialActions: PlanMicroActionInput[] = microActions.map((action) => ({
    position: action.position,
    title: action.title,
    details: action.details ?? "",
    durationMinutes: action.duration_minutes,
    fallbackTitle: action.fallback_title,
    fallbackDetails: action.fallback_details ?? "",
    fallbackDurationMinutes: action.fallback_duration_minutes,
  }));

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding/review"
      title=""
      description=""
      className="mx-auto max-w-3xl"
    >
      <div className="grid gap-4">
        <Card className="bg-[var(--surface-muted)]">
          <h2 className="text-xl font-semibold">{locale === "ko" ? "생성된 마이크로 행동을 확인해 주세요." : "Review your generated micro-actions."}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">
            {locale === "ko"
              ? "이 단계에서 행동을 수정하거나 하나 더 추가할 수 있어요. 선택한 행동이 오늘 행동이 됩니다."
              : "You can edit the actions or add one more before you start. The selected action becomes today's action."}
          </p>
          {params.error ? <p className="mt-3 text-sm text-amber-800">{params.error}</p> : null}
        </Card>
        <PlanReviewForm locale={locale} initialActions={initialActions} />
      </div>
    </PageShell>
  );
}
