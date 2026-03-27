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
    notice?: string;
  }>;
};

export default async function OnboardingReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const session = await getHabitSession();
  const user = await getAuthenticatedUser();

  if (!user || !session.goalId || !session.planId || !session.reviewMeta) {
    return (
      <PageShell auth={auth} locale={locale} path="/onboarding/review" title="" description="" className="mx-auto max-w-3xl">
        <Card className="bg-[var(--surface-strong)] text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">검토할 계획이 아직 없어요.</p>
          <Link href="/onboarding" className="mt-4 inline-block">
            <Button>온보딩으로</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  let initialActions: PlanMicroActionInput[] = session.reviewActions ?? [];

  if (initialActions.length === 0) {
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

    initialActions = microActions.map((action) => ({
      position: action.position,
      title: action.title,
      details: action.details ?? "",
      durationMinutes: action.duration_minutes,
      fallbackTitle: action.fallback_title,
      fallbackDetails: action.fallback_details ?? "",
      fallbackDurationMinutes: action.fallback_duration_minutes,
    }));
  }

  return (
    <PageShell auth={auth} locale={locale} path="/onboarding/review" title="계획 확인" description="짧게 보고 시작합니다." className="mx-auto max-w-3xl">
      <div className="grid gap-4">
        {params.error ? (
          <Card className="border-amber-300 bg-amber-50/90">
            <p className="text-sm text-amber-900">{params.error}</p>
          </Card>
        ) : null}
        <PlanReviewForm locale={locale} initialActions={initialActions} notice={params.notice} reviewMeta={session.reviewMeta} />
      </div>
    </PageShell>
  );
}
