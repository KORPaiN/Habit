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

const localeOptions: Locale[] = ["ko"];

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
      title={locale === "ko" ? "한국어로 시작해요." : "Choose your language once and keep the flow consistent."}
      description={
        locale === "ko"
          ? "가입 후에도 한국어로 이어집니다."
          : "The language you choose at sign-up becomes the language for your plans and interface. It cannot be changed inside the app later."
      }
      className="mx-auto max-w-xl"
    >
      <Card className="text-center">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {locale === "ko" ? "언어" : "Choose language"}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {localeOptions.map((option) => (
                <span
                  key={option}
                  className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  한국어
                </span>
              ))}
            </div>
          </div>

          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "지금은 한국어만 지원합니다."
              : "We ask for this only during sign-up. After that, the saved language keeps both the AI plan and the interface aligned."}
          </p>

          {auth.isAuthenticated ? (
            <form action={completeSignupWithLocale} className="space-y-3">
              <input type="hidden" name="locale" value="ko" />
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white"
              >
                {locale === "ko" ? "한국어로 계속하기" : "Continue with this language"}
              </button>
            </form>
          ) : (
            <GoogleAuthButton locale={locale} signupLocale="ko" nextPath={nextPath} />
          )}

          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko" ? "Google 로그인만 지원합니다." : "This app supports Google sign-in only."}
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
