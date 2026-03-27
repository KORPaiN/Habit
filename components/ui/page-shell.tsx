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
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-6rem] top-20 h-48 w-48 rounded-full bg-[color:var(--accent-soft)] blur-3xl" />
        <div className="absolute right-[-4rem] top-12 h-56 w-56 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />
      </div>
      <header className="mb-8 rounded-[calc(var(--radius-lg)+6px)] border border-white/55 bg-[var(--background-soft)] px-5 py-5 shadow-[var(--shadow-sm)] backdrop-blur-md sm:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <Link href="/" className="inline-flex rounded-full border border-white/55 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                {copy.brand}
              </Link>
              {eyebrow ? <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">{eyebrow}</p> : null}
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-[2.8rem]">{title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--foreground-soft)] sm:text-base">{description}</p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-2 rounded-full border border-white/55 bg-white/70 px-3 py-2 text-xs text-[var(--muted)] backdrop-blur">
                <span>{copy.langLabel}</span>
                <Link
                  className={cn(
                    "rounded-full px-3 py-1.5 font-medium transition",
                    locale === "en" ? "bg-[var(--primary)] text-white" : "bg-transparent text-[var(--foreground)] hover:bg-white/85",
                  )}
                  href={`/api/locale?value=en&redirect=${encodeURIComponent(path)}`}
                >
                  {copy.langEnglish}
                </Link>
                <Link
                  className={cn(
                    "rounded-full px-3 py-1.5 font-medium transition",
                    locale === "ko" ? "bg-[var(--primary)] text-white" : "bg-transparent text-[var(--foreground)] hover:bg-white/85",
                  )}
                  href={`/api/locale?value=ko&redirect=${encodeURIComponent(path)}`}
                >
                  {copy.langKorean}
                </Link>
              </div>
              {showAuthControls ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)] lg:justify-end">
                  {auth?.isAuthenticated ? (
                    <>
                      <span className="rounded-full border border-white/55 bg-white/70 px-3 py-2">{auth.email ?? (locale === "ko" ? "로그인됨" : "Signed in")}</span>
                      <form action={signOutAction}>
                        <button
                          className="rounded-full border border-[color:var(--border)] bg-white/80 px-4 py-2 font-semibold text-[var(--foreground)] transition hover:bg-white"
                          type="submit"
                        >
                          {locale === "ko" ? "로그아웃" : "Log out"}
                        </button>
                      </form>
                    </>
                  ) : (
                    <Link
                      className="rounded-full border border-[color:var(--border)] bg-white/82 px-4 py-2 font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:bg-white"
                      href={`/login?next=${encodeURIComponent(path)}`}
                    >
                      {locale === "ko" ? "Google로 로그인" : "Sign in with Google"}
                    </Link>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            <Link className="rounded-full border border-white/55 bg-white/72 px-4 py-2.5 transition hover:bg-white" href="/today">
              {copy.navToday}
            </Link>
            <Link className="rounded-full border border-white/55 bg-white/72 px-4 py-2.5 transition hover:bg-white" href="/onboarding">
              {copy.navOnboarding}
            </Link>
            <Link className="rounded-full border border-white/55 bg-white/72 px-4 py-2.5 transition hover:bg-white" href="/review">
              {copy.navReview}
            </Link>
          </nav>
        </div>
      </header>
      <section className={cn("flex-1", className)}>{children}</section>
    </main>
  );
}
