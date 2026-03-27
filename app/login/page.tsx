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
      title={locale === "ko" ? "Google 로그인으로 이동 중..." : "Opening Google sign in..."}
      description=""
      className="mx-auto max-w-xl"
    >
      <Card className="text-center">
        <div className="space-y-4">
          <GoogleAuthButton autoStart locale={locale} nextPath={params.next?.startsWith("/") ? params.next : "/today"} />
          {params.error ? (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {params.error}
            </div>
          ) : null}
          <p className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
            {locale === "ko" ? "잠시만 기다리면 Google 로그인 창이 열립니다." : "Your Google sign-in window should open in a moment."}
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
