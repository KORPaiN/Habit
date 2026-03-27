import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getHabitSession } from "@/lib/habit-session";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser, getAuthShellState } from "@/lib/supabase/auth";
import { getUserAnchors } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Database } from "@/types";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
    reselect?: string;
  }>;
};

function isAiAvailabilityError(error?: string) {
  if (!error) {
    return false;
  }

  const normalized = error.toLowerCase();
  return normalized.includes("openai") || normalized.includes("quota");
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

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding"
      eyebrow="온보딩"
      title={isReselect ? "행동 다시 고르기" : "작게 시작하기"}
      description={isReselect ? "다시 고르고 이어갑니다." : "한 단계씩 정합니다."}
      className="mx-auto w-full max-w-3xl"
    >
      {showAiBanner ? (
        <Card className="border-amber-300 bg-amber-50/90">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">AI 상태</p>
          <p className="mt-3 text-sm leading-6 text-amber-900">지금은 AI가 느립니다. 가능한 범위에서 규칙 기반 후보도 함께 보여줍니다.</p>
        </Card>
      ) : null}
      <OnboardingForm
        locale={locale}
        isAuthenticated={auth.isAuthenticated}
        error={params.error}
        savedAnchors={savedAnchors}
        initialReviewMeta={session.reviewMeta}
        isReselect={isReselect}
      />
    </PageShell>
  );
}
