import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { PageShell } from "@/components/ui/page-shell";
import { StatPill } from "@/components/review/stat-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  "Name a goal that feels important but hard to start.",
  "Get one tiny action for today, not a full plan for life.",
  "If today misses, shrink the action instead of starting over.",
];

export default function LandingPage() {
  return (
    <PageShell
      eyebrow="Micro-habit coach"
      title="Start smaller than your resistance."
      description="Habit turns a heavy goal into one calm, concrete step you can finish in a few minutes. No shame, no giant streak pressure, just a lighter way to begin."
      className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
    >
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-200/40 via-transparent to-emerald-200/40" />
        <div className="relative">
          <div className="flex flex-wrap gap-3">
            <StatPill label="Focus" value="One action" />
            <StatPill label="Time" value="1 to 5 minutes" />
            <StatPill label="Recovery" value="Make it smaller" />
          </div>
          <h2 className="mt-8 max-w-2xl text-4xl font-semibold leading-tight text-balance">
            A habit app for people who freeze at the starting line.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
            This MVP is built around tiny execution loops: choose a goal, set a realistic window, receive a micro-plan,
            then return each day for one doable step.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/onboarding">
              <Button>
                Start your first plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost">Create account</Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-3xl bg-white/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Step {index + 1}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6">
        <Card className="bg-emerald-950 text-white">
          <Sparkles className="h-5 w-5 text-amber-300" />
          <h3 className="mt-4 text-2xl font-semibold">Designed to lower pressure</h3>
          <p className="mt-3 text-sm leading-6 text-emerald-50/80">
            Calm copy, one primary action per screen, and a fallback path for rough days.
          </p>
        </Card>

        <Card>
          <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
          <h3 className="mt-4 text-xl font-semibold">Included in this scaffold</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <li>Landing and auth screens</li>
            <li>Onboarding flow with mock AI plan</li>
            <li>Today, recovery, and weekly review pages</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
