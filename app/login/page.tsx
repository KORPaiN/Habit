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
      title=""
      description=""
      className="mx-auto max-w-xl"
    >
      <Card className="text-center">
        <div>
          <GoogleAuthButton autoStart locale={locale} nextPath={params.next?.startsWith("/") ? params.next : "/today"} />
          {params.error ? (
            <div className="mt-4 rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {params.error}
            </div>
          ) : null}
        </div>
      </Card>
    </PageShell>
  );
}
