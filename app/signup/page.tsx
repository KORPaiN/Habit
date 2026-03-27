import Link from "next/link";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale, isLocale, type Locale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type SignupPageProps = {
  searchParams?: Promise<{
    locale?: string;
  }>;
};

const localeOptions: Locale[] = ["en", "ko"];

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};
  const fallbackLocale = await getLocale();
  const locale = isLocale(params.locale) ? params.locale : fallbackLocale;
  const auth = await getAuthShellState();

  return (
    <PageShell
      auth={auth}
      showAuthControls={false}
      locale={locale}
      path={`/signup?locale=${locale}`}
      eyebrow={locale === "ko" ? "계정 만들기" : "Create account"}
      title={locale === "ko" ? "처음 언어를 고르면 이후에는 그대로 이어집니다." : "Choose your language once and keep the flow consistent."}
      description={
        locale === "ko"
          ? "가입할 때 선택한 언어로 계획과 화면이 계속 맞춰집니다. 가입 후에는 앱 안에서 언어를 바꿀 수 없어요."
          : "The language you choose at sign-up becomes the language for your plans and interface. It cannot be changed inside the app later."
      }
      className="mx-auto max-w-xl"
    >
      <Card>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {locale === "ko" ? "언어 선택" : "Choose language"}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {localeOptions.map((option) => {
                const isSelected = option === locale;

                return (
                  <Link
                    key={option}
                    href={`/signup?locale=${option}`}
                    className={isSelected ? "rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" : "rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--foreground)]"}
                  >
                    {option === "ko" ? "한국어" : "English"}
                  </Link>
                );
              })}
            </div>
          </div>

          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "이 언어 선택은 첫 가입 때만 받습니다. 이후에는 저장된 언어로 AI 계획과 화면 문구가 계속 표시됩니다."
              : "We ask for this only during sign-up. After that, the saved language keeps both the AI plan and the interface aligned."}
          </p>

          <GoogleAuthButton locale={locale} signupLocale={locale} nextPath="/onboarding" />

          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko" ? "이 앱은 Google 로그인만 지원합니다." : "This app supports Google sign-in only."}
          </p>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {locale === "ko" ? "이미 계정이 있나요?" : "Already have an account?"}{" "}
          <Link href="/login" className="font-semibold text-[var(--primary)]">
            {locale === "ko" ? "로그인" : "Sign in"}
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}
