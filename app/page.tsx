import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getAuthShellState } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const auth = await getAuthShellState();
  const locale = auth.isAuthenticated ? await getLocale() : "ko";

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/"
      title={locale === "ko" ? "작게 시작하면 됩니다." : "Start smaller than your resistance."}
      description=""
      className="grid gap-6"
    >
      <Card className="relative overflow-hidden border-white/65 bg-[var(--surface-strong)] px-5 py-5 text-center sm:px-6 sm:py-6">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[color:var(--accent-soft)] via-transparent to-[color:var(--primary-soft)]" />
        <div className="absolute -right-20 top-10 h-36 w-36 rounded-full bg-[color:var(--primary-soft)]/70 blur-3xl" />
        <div className="relative">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-medium text-[var(--primary)]">
              {locale === "ko" ? "오늘은 한 단계면 충분해요." : "You do not need a whole new life plan today."}
            </p>
          </div>
          <h2 className="mt-3 mx-auto max-w-3xl text-3xl font-semibold leading-tight text-balance sm:text-[2.6rem]">
            {locale === "ko" ? "시작이 어려운 사람을 위한 습관 앱" : "A habit app for people who freeze at the starting line."}
          </h2>
          <p className="mt-3 mx-auto max-w-xl text-sm leading-6 text-[var(--foreground-soft)] sm:text-base">
            {locale === "ko"
              ? "목표를 정하고, 작은 계획을 만들고, 오늘 할 한 가지만 실행합니다."
              : "This MVP is built around tiny execution loops: choose a goal, set a realistic window, receive a micro-plan, then return each day for one doable step."}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/onboarding">
              <Button size="lg">
                {locale === "ko" ? "첫 계획 만들기" : "Start your first plan"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
