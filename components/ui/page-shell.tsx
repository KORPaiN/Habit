import Link from "next/link";
import type { PropsWithChildren } from "react";

import { signOutAction } from "@/app/auth/actions";
import { commonCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locale";
import { cn } from "@/lib/utils";

type PageShellProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  description: string;
  className?: string;
  locale: Locale;
  path: string;
  auth?: {
    isAuthenticated: boolean;
    email?: string | null;
  };
  showAuthControls?: boolean;
}>;

export function PageShell({
  title,
  eyebrow,
  description,
  className,
  children,
  locale,
  path,
  auth,
  showAuthControls = true,
}: PageShellProps) {
  const copy = commonCopy[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-semibold tracking-[0.24em] text-[var(--primary)] uppercase">
            {copy.brand}
          </Link>
          {eyebrow ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{eyebrow}</p> : null}
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-balance sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
        </div>
        <div className="flex flex-col gap-3">
          <nav className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            <Link className="rounded-full bg-white/60 px-4 py-2" href="/today">
              {copy.navToday}
            </Link>
            <Link className="rounded-full bg-white/60 px-4 py-2" href="/onboarding">
              {copy.navOnboarding}
            </Link>
            <Link className="rounded-full bg-white/60 px-4 py-2" href="/review">
              {copy.navReview}
            </Link>
          </nav>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>{copy.langLabel}</span>
            <Link
              className={cn("rounded-full px-3 py-1", locale === "en" ? "bg-[var(--primary)] text-white" : "bg-white/70")}
              href={`/api/locale?value=en&redirect=${encodeURIComponent(path)}`}
            >
              {copy.langEnglish}
            </Link>
            <Link
              className={cn("rounded-full px-3 py-1", locale === "ko" ? "bg-[var(--primary)] text-white" : "bg-white/70")}
              href={`/api/locale?value=ko&redirect=${encodeURIComponent(path)}`}
            >
              {copy.langKorean}
            </Link>
          </div>
          {showAuthControls ? (
            <div className="flex items-center justify-end gap-2 text-xs text-[var(--muted)]">
              {auth?.isAuthenticated ? (
                <>
                  <span className="rounded-full bg-white/60 px-3 py-2">{auth.email ?? (locale === "ko" ? "로그인됨" : "Signed in")}</span>
                  <form action={signOutAction}>
                    <button className="rounded-full bg-white/80 px-4 py-2 font-semibold text-[var(--foreground)]" type="submit">
                      {locale === "ko" ? "로그아웃" : "Log out"}
                    </button>
                  </form>
                </>
              ) : (
                <Link className="rounded-full bg-white/80 px-4 py-2 font-semibold text-[var(--foreground)]" href={`/login?next=${encodeURIComponent(path)}`}>
                  {locale === "ko" ? "Google 로그인" : "Sign in with Google"}
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </header>
      <section className={cn("flex-1", className)}>{children}</section>
    </main>
  );
}
