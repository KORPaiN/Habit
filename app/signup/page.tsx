import Link from "next/link";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export default async function SignupPage() {
  const locale = await getLocale();
  const auth = await getAuthShellState();

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/signup"
      eyebrow={locale === "ko" ? "계정 만들기" : "Create account"}
      title={locale === "ko" ? "Google 계정 하나로 바로 시작하세요." : "Start right away with your Google account."}
      description={
        locale === "ko"
          ? "회원가입도 Google만 사용합니다. 한 번 연결하면 목표, 계획 버전, 주간 리뷰를 같은 계정으로 이어서 사용할 수 있어요."
          : "Sign-up also uses Google only. Once connected, your goals, plan versions, and weekly reviews stay under the same account."
      }
      className="mx-auto max-w-xl"
    >
      <Card>
        <div className="space-y-4">
          <GoogleAuthButton locale={locale} nextPath="/onboarding" />
          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko"
              ? "이제 이메일 입력과 비밀번호 생성은 제거했습니다. Google 인증이 앱의 유일한 가입 방식입니다."
              : "Email and password fields have been removed. Google is now the only sign-up method for this app."}
          </p>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {locale === "ko" ? "이미 계정이 있나요?" : "Already have an account?"}{" "}
          <Link href="/login" className="font-semibold text-[var(--primary)]">
            {locale === "ko" ? "Google로 로그인" : "Sign in with Google"}
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}
