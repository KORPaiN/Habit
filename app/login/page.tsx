import Link from "next/link";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const locale = await getLocale();
  const params = (await searchParams) ?? {};

  return (
    <PageShell
      locale={locale}
      path="/login"
      eyebrow={locale === "ko" ? "다시 오신 것을 환영해요" : "Welcome back"}
      title={locale === "ko" ? "부드럽게 다시 들어오세요." : "Step in gently."}
      description={
        locale === "ko"
          ? "Google 계정으로만 로그인합니다. 비밀번호 없이 바로 오늘의 작은 행동으로 돌아올 수 있어요."
          : "Sign in only with Google. No password to remember, just a quick return to today's small action."
      }
      className="mx-auto max-w-xl"
    >
      <Card>
        <div className="space-y-4">
          <GoogleAuthButton locale={locale} nextPath="/today" />
          {params.error ? (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {params.error}
            </div>
          ) : null}
          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "Supabase Auth에서 Google provider만 활성화해 두면 이 버튼 하나로 로그인과 계정 생성이 함께 처리됩니다."
              : "With Google as the only enabled Supabase provider, this one button handles both sign-in and account creation."}
          </p>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {locale === "ko" ? "처음이신가요?" : "New here?"}{" "}
          <Link href="/signup" className="font-semibold text-[var(--primary)]">
            {locale === "ko" ? "Google 시작 안내 보기" : "See the Google sign-up flow"}
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}
