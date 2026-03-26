import Link from "next/link";
import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  description: string;
  className?: string;
}>;

export function PageShell({ title, eyebrow, description, className, children }: PageShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-semibold tracking-[0.24em] text-[var(--primary)] uppercase">
            Habit
          </Link>
          {eyebrow ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{eyebrow}</p> : null}
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-balance sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <Link className="rounded-full bg-white/60 px-4 py-2" href="/today">
            Today
          </Link>
          <Link className="rounded-full bg-white/60 px-4 py-2" href="/onboarding">
            Onboarding
          </Link>
          <Link className="rounded-full bg-white/60 px-4 py-2" href="/review">
            Weekly review
          </Link>
        </nav>
      </header>
      <section className={cn("flex-1", className)}>{children}</section>
    </main>
  );
}
