import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/onboarding"
      eyebrow={locale === "ko" ? "온보딩" : "Onboarding"}
      title={locale === "ko" ? "목표를 오늘 가능한 크기로 줄여볼게요." : "Let's make the goal lighter."}
      description={
        locale === "ko"
          ? "몇 가지 짧은 질문에 답하면 실제로 시작할 수 있을 만큼 작은 첫 계획을 만듭니다."
          : "Answer a few short questions so the plan starts small enough to actually happen."
      }
      className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
    >
      <OnboardingForm locale={locale} isAuthenticated={auth.isAuthenticated} error={params.error} />
    </PageShell>
  );
}
