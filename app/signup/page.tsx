import Link from "next/link";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const locale = await getLocale();
  const auth = await getAuthShellState();

  return (
    <PageShell
      auth={auth}
      showAuthControls={false}
      locale={locale}
      path="/signup"
      eyebrow={locale === "ko" ? "계정 만들기" : "Create account"}
      title={locale === "ko" ? "Google 계정 하나로 바로 시작하세요." : "Start right away with your Google account."}
      description={
        locale === "ko"
          ? "가입도 Google만 사용합니다. 한 번 연결하면 목표와 계획을 같은 계정으로 이어서 사용할 수 있어요."
          : "Sign-up also uses Google only. Once connected, your goals and plans stay under the same account."
      }
      className="mx-auto max-w-xl"
    >
      <Card>
        <div className="space-y-4">
          <GoogleAuthButton locale={locale} nextPath="/onboarding" />
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
