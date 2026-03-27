import Link from "next/link";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const params = (await searchParams) ?? {};

  return (
    <PageShell
      auth={auth}
      showAuthControls={false}
      locale={locale}
      path="/login"
      eyebrow={locale === "ko" ? "로그인" : "Welcome back"}
      title={locale === "ko" ? "다시 시작해요." : "Step in gently."}
      description={
        locale === "ko"
          ? "Google 계정으로 바로 로그인할 수 있어요."
          : "Sign in only with Google. No password to remember, just a quick way back in."
      }
      className="mx-auto max-w-xl"
    >
      <Card>
        <div className="space-y-4">
          <GoogleAuthButton locale={locale} nextPath={params.next?.startsWith("/") ? params.next : "/today"} />
          {params.error ? (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {params.error}
            </div>
          ) : null}
          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko" ? "비밀번호 없이 바로 들어올 수 있어요." : "Use your Google account to get back in quickly."}
          </p>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {locale === "ko" ? "처음이신가요?" : "New here?"}{" "}
          <Link href="/signup" className="font-semibold text-[var(--primary)]">
            {locale === "ko" ? "가입 안내 보기" : "See sign-up"}
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}
