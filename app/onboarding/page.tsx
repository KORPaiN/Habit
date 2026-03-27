import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function isAiAvailabilityError(error?: string) {
  if (!error) {
    return false;
  }

  const normalized = error.toLowerCase();
  return normalized.includes("openai") || normalized.includes("quota") || normalized.includes("ai 플랜");
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const showAiBanner = isAiAvailabilityError(params.error);

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding"
      eyebrow={locale === "ko" ? "온보딩" : "Onboarding"}
      title={locale === "ko" ? "오늘 할 수 있게 줄여볼게요." : "Let's make the goal lighter."}
      description={
        locale === "ko"
          ? "짧게 답하면 작은 첫 계획을 만듭니다."
          : "Answer a few short questions so the plan starts small enough to actually happen."
      }
      className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]"
    >
      {showAiBanner ? (
        <Card className="border-amber-300 bg-amber-50/90 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            {locale === "ko" ? "AI 연결 상태" : "AI availability"}
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            {locale === "ko"
              ? "지금은 AI 플랜을 만들 수 없어요. quota를 확인해 주세요."
              : "AI micro-plan generation is currently unavailable. Restore OpenAI billing or quota and try again."}
          </p>
        </Card>
      ) : null}
      <OnboardingForm locale={locale} isAuthenticated={auth.isAuthenticated} error={params.error} />
    </PageShell>
  );
}
