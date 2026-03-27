import Link from "next/link";
import type { PropsWithChildren } from "react";
import { ChevronDown, LogOut, Sprout } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
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
    displayName?: string | null;
    avatarUrl?: string | null;
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
  const profileLabel = auth?.displayName ?? auth?.email ?? (locale === "ko" ? "프로필" : "Profile");

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-6rem] top-20 h-48 w-48 rounded-full bg-[color:var(--accent-soft)] blur-3xl" />
        <div className="absolute right-[-4rem] top-12 h-56 w-56 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />
      </div>
      <header className="sticky top-3 z-30 mb-8 rounded-[calc(var(--radius-lg)+6px)] border border-white/55 bg-[var(--background-soft)] px-4 py-4 shadow-[var(--shadow-sm)] backdrop-blur-md sm:px-5 lg:top-4">
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-full border border-white/55 bg-white/76 px-3 py-2 text-[var(--foreground)] transition hover:bg-white"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]">
                <Sprout className="h-5 w-5" />
              </span>
              <span className="text-left">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                  {locale === "ko" ? "홈" : "Home"}
                </span>
                <span className="block text-sm font-semibold">{copy.brand}</span>
              </span>
            </Link>

            <div className="flex items-center justify-end gap-2">
              {showAuthControls ? (
                auth?.isAuthenticated ? (
                  <details className="group relative">
                    <summary className="flex list-none items-center gap-2 rounded-full border border-white/55 bg-white/80 px-2 py-2 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)] transition hover:bg-white [&::-webkit-details-marker]:hidden">
                      {auth.avatarUrl ? (
                        <img
                          alt={profileLabel}
                          className="h-9 w-9 rounded-full border border-white/80 object-cover"
                          referrerPolicy="no-referrer"
                          src={auth.avatarUrl}
                        />
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                          {profileLabel.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-[var(--muted)] transition group-open:rotate-180" />
                    </summary>
                    <div className="absolute right-0 top-[calc(100%+0.6rem)] w-52 rounded-[var(--radius-md)] border border-white/55 bg-white/92 p-2 shadow-[var(--shadow-md)] backdrop-blur">
                      <div className="rounded-[calc(var(--radius-md)-6px)] bg-[var(--surface-muted)] px-3 py-2">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{auth.displayName ?? (locale === "ko" ? "로그인됨" : "Signed in")}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{auth.email}</p>
                      </div>
                      <form action={signOutAction} className="mt-2">
                        <button
                          className="flex w-full items-center justify-center gap-2 rounded-[calc(var(--radius-md)-6px)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                          type="submit"
                        >
                          <LogOut className="h-4 w-4" />
                          {locale === "ko" ? "로그아웃" : "Log out"}
                        </button>
                      </form>
                    </div>
                  </details>
                ) : (
                  <GoogleAuthButton locale={locale} nextPath={path} fullWidth={false} compact />
                )
              ) : null}
            </div>
          </div>

          <div className="text-center">
            <div className="mx-auto max-w-3xl">
              {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">{eyebrow}</p> : null}
              <h1 className={cn("max-w-3xl text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-[2.8rem]", eyebrow ? "mt-3" : "")}>{title}</h1>
              {description ? <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--foreground-soft)] sm:text-base">{description}</p> : null}
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-2 text-sm text-[var(--muted)]">
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
