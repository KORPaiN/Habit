import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale, isLocale, type Locale } from "@/lib/locale";
import { getAuthShellState, getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { completeSignupWithLocale } from "@/app/signup/actions";
import type { Database } from "@/types";

export const dynamic = "force-dynamic";

type SignupPageProps = {
  searchParams?: Promise<{
    locale?: string;
    next?: string;
    error?: string;
  }>;
};

const localeOptions: Locale[] = ["en", "ko"];

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};
  const fallbackLocale = await getLocale();
  const locale = isLocale(params.locale) ? params.locale : fallbackLocale;
  const auth = await getAuthShellState();
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/onboarding";
  const authenticatedUser = await getAuthenticatedUser();
  const existingUser =
    authenticatedUser
      ? await getSupabaseAdminClient().from("users").select("locale").eq("id", authenticatedUser.id).maybeSingle()
      : null;
  const existingLocale = (existingUser?.data as Pick<Database["public"]["Tables"]["users"]["Row"], "locale"> | null)?.locale;

  if (existingUser?.error) {
    throw new Error(existingUser.error.message);
  }

  if (existingLocale) {
    redirect(nextPath as never);
  }

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

          {auth.isAuthenticated ? (
            <form action={completeSignupWithLocale} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white"
              >
                {locale === "ko" ? "이 언어로 계속하기" : "Continue with this language"}
              </button>
            </form>
          ) : (
            <GoogleAuthButton locale={locale} signupLocale={locale} nextPath={nextPath} />
          )}

          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko" ? "이 앱은 Google 로그인만 지원합니다." : "This app supports Google sign-in only."}
          </p>
        </div>
        {params.error ? (
          <div className="mt-4 rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {params.error}
          </div>
        ) : null}
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
