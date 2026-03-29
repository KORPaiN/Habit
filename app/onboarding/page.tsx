import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser, getAuthShellState } from "@/lib/supabase/auth";
import { getHabitReviewStateFromSession } from "@/lib/supabase/demo-data";
import { getUserAnchors } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Database } from "@/types";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
    reselect?: string;
    review?: string;
    notice?: string;
    resume?: string;
    step?: string;
  }>;
};

function isAiAvailabilityError(error?: string) {
  if (!error) {
    return false;
  }

  const normalized = error.toLowerCase();
  return normalized.includes("openai") || normalized.includes("quota");
}

function parseStep(value?: string) {
  const step = Number(value);

  if (!Number.isInteger(step) || step < 1 || step > 5) {
    return undefined;
  }

  return step;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const user = await getAuthenticatedUser();
  const session = await getHabitSession();
  const savedAnchors: Array<Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "label" | "preferred_time" | "updated_at">> =
    user ? await getUserAnchors(await getSupabaseServerClient(), user.id) : [];
  const showAiBanner = isAiAvailabilityError(params.error);
  const isReselect = params.reselect === "1";
  const isReviewMode = params.review === "1";
  const shouldResumeDraft = params.resume === "1";
  const reviewState = user && session.goalId ? await getHabitReviewStateFromSession(session) : null;

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding"
      eyebrow="온보딩"
      title={isReviewMode ? "마지막 확인" : isReselect ? "행동 다시 고르기" : "작게 시작하기"}
      description={isReviewMode ? "오늘 할 행동만 고르면 돼요." : isReselect ? "지금 맞는 행동으로 다시 골라요." : "한 단계씩 정하면 돼요."}
      className="mx-auto w-full max-w-3xl"
    >
      {showAiBanner ? (
        <Card className="border-amber-300 bg-amber-50/90">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">AI 상태</p>
          <p className="mt-3 text-sm leading-6 text-amber-900">지금은 AI가 잠시 느려서, 가능하면 기본 초안을 먼저 보여드릴게요.</p>
        </Card>
      ) : null}
      <OnboardingForm
        locale={locale}
        isAuthenticated={auth.isAuthenticated}
        error={params.error}
        savedAnchors={savedAnchors}
        initialReviewMeta={reviewState?.meta}
        reviewActions={reviewState?.reviewActions}
        reviewNotice={params.notice}
        isReselect={isReselect}
        isReviewMode={isReviewMode}
        resumeDraft={shouldResumeDraft}
        resumeStep={shouldResumeDraft ? parseStep(params.step) : undefined}
      />
    </PageShell>
  );
}
