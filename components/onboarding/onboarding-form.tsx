"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { submitOnboarding } from "@/app/onboarding/actions";
import { OnboardingPreview } from "@/components/onboarding/onboarding-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Locale } from "@/lib/locale";
import { buildAnchorLabel, minutesLabel } from "@/lib/utils/habit";
import { mockOnboardingData } from "@/lib/utils/mock-habit";
import type { OnboardingInput } from "@/lib/validators/habit";

type OnboardingFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  error?: string;
};

const DRAFT_KEY = "habit_onboarding_draft";

function buildPreviewPlan(values: OnboardingInput, locale: Locale) {
  const normalizedGoal = values.goal.trim() || mockOnboardingData.goal;
  const lowerGoal = normalizedGoal.toLowerCase();
  const isReadGoal = /read|book/.test(lowerGoal);
  const isWriteGoal = /write|note|journal/.test(lowerGoal);
  const shortDuration = values.difficulty === "hard" ? 1 : Math.min(2, values.availableMinutes);
  const mediumDuration = values.difficulty === "hard" ? 1 : Math.min(3, values.availableMinutes);

  if (isReadGoal) {
    return {
      sourceLabel: "Input preview",
      goalSummary: `We shrink "${normalizedGoal}" into a tiny reading step you can actually finish today.`,
      selectedAnchor: buildAnchorLabel(values.anchor, locale),
      todayAction: {
        title: "Open your book and read one page",
        reason: "One page is small enough to start without friction.",
        durationMinutes: shortDuration,
        fallbackAction: "Read one sentence",
      },
      microActions: [
        {
          title: "Open your book and read one page",
          reason: "One page is small enough to start without friction.",
          durationMinutes: shortDuration,
          fallbackAction: "Read one sentence",
        },
        {
          title: "Highlight one useful line",
          reason: "Marking one line keeps the habit visible.",
          durationMinutes: mediumDuration,
          fallbackAction: "Touch the book and stop",
        },
      ],
      fallbackAction: "Read one sentence",
    };
  }

  if (isWriteGoal) {
    return {
      sourceLabel: "Input preview",
      goalSummary: `We turn "${normalizedGoal}" into a tiny writing action you can start today.`,
      selectedAnchor: buildAnchorLabel(values.anchor, locale),
      todayAction: {
        title: "Open your notes app and write one sentence",
        reason: "One sentence is enough to begin without pressure.",
        durationMinutes: shortDuration,
        fallbackAction: "Write three words",
      },
      microActions: [
        {
          title: "Open your notes app and write one sentence",
          reason: "One sentence is enough to begin without pressure.",
          durationMinutes: shortDuration,
          fallbackAction: "Write three words",
        },
        {
          title: "List one idea to return to later",
          reason: "A single idea lowers friction for the next session.",
          durationMinutes: mediumDuration,
          fallbackAction: "Open the document and stop",
        },
      ],
      fallbackAction: "Write three words",
    };
  }

  return {
    sourceLabel: "Input preview",
    goalSummary: `We shrink "${normalizedGoal}" into the smallest useful first step for today.`,
    selectedAnchor: buildAnchorLabel(values.anchor, locale),
    todayAction: {
      title: `Prepare one thing you need for "${normalizedGoal}"`,
      reason: "Preparation lowers the barrier to starting.",
      durationMinutes: shortDuration,
      fallbackAction: "Touch the tool and stop",
    },
    microActions: [
      {
        title: `Prepare one thing you need for "${normalizedGoal}"`,
        reason: "Preparation lowers the barrier to starting.",
        durationMinutes: shortDuration,
        fallbackAction: "Touch the tool and stop",
      },
      {
        title: `Open the first step for "${normalizedGoal}"`,
        reason: "Seeing the starting point makes it easier to return.",
        durationMinutes: mediumDuration,
        fallbackAction: "Look at the tool and stop",
      },
    ],
    fallbackAction: "Touch the tool and stop",
  };
}

export function OnboardingForm({ locale, isAuthenticated, error }: OnboardingFormProps) {
  const [values, setValues] = useState<OnboardingInput>(mockOnboardingData);

  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<OnboardingInput>;
      setValues((current) => ({
        goal: typeof parsed.goal === "string" && parsed.goal.trim() ? parsed.goal : current.goal,
        availableMinutes: typeof parsed.availableMinutes === "number" ? parsed.availableMinutes : current.availableMinutes,
        difficulty: parsed.difficulty ?? current.difficulty,
        preferredTime: parsed.preferredTime ?? current.preferredTime,
        anchor: parsed.anchor ?? current.anchor,
      }));
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  }, [values]);

  const preview = buildPreviewPlan(values, locale);

  function updateValue<Key extends keyof OnboardingInput>(key: Key, value: OnboardingInput[Key]) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <>
      <Card>
        <form action={submitOnboarding} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {locale === "ko" ? "What goal do you want help starting?" : "What goal do you want help starting?"}
            </label>
            <Input
              name="goal"
              value={values.goal}
              onChange={(event) => updateValue("goal", event.target.value)}
              placeholder={locale === "ko" ? "Example: build a reading habit" : "Example: build a reading habit"}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "Available minutes" : "Available minutes"}</label>
              <Input
                name="availableMinutes"
                value={String(values.availableMinutes)}
                onChange={(event) => updateValue("availableMinutes", Number(event.target.value || 1))}
                type="number"
                min={1}
                max={30}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "Perceived difficulty" : "Perceived difficulty"}</label>
              <Select name="difficulty" value={values.difficulty} onChange={(event) => updateValue("difficulty", event.target.value as OnboardingInput["difficulty"])}>
                <option value="gentle">Gentle</option>
                <option value="steady">Steady</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "Preferred time" : "Preferred time"}</label>
              <Select name="preferredTime" value={values.preferredTime} onChange={(event) => updateValue("preferredTime", event.target.value as OnboardingInput["preferredTime"])}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "ko" ? "Anchor" : "Anchor"}</label>
              <Select name="anchor" value={values.anchor} onChange={(event) => updateValue("anchor", event.target.value as OnboardingInput["anchor"])}>
                <option value="after-coffee">After coffee</option>
                <option value="after-shower">After shower</option>
                <option value="before-work">Before work</option>
                <option value="before-bed">Before bed</option>
              </Select>
            </div>
          </div>
          <div className="rounded-3xl bg-[var(--primary-soft)] p-4 text-sm leading-6 text-[var(--primary)]">
            We keep this short on purpose. You only need enough detail to shape today's first tiny step.
          </div>
          {error ? (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {error}
            </div>
          ) : null}
          {!isAuthenticated ? (
            <div className="rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              Sign in with Google first to save this plan. What you typed stays in this browser for now.
            </div>
          ) : null}
          {isAuthenticated ? (
            <Button type="submit" fullWidth>
              Generate micro-plan
            </Button>
          ) : (
            <Link href="/login?next=%2Fonboarding">
              <Button type="button" fullWidth>
                Sign in with Google
              </Button>
            </Link>
          )}
        </form>
      </Card>

      <div className="grid gap-6">
        <OnboardingPreview values={values} locale={locale} />
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Input-based plan preview</p>
              <h3 className="mt-2 text-xl font-semibold">This is the kind of first plan your current input will create.</h3>
            </div>
            <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              {preview.sourceLabel}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{preview.goalSummary}</p>

          <div className="mt-5 rounded-3xl bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Selected anchor</p>
            <p className="mt-2 font-medium">{preview.selectedAnchor}</p>
          </div>

          <div className="mt-4 rounded-3xl bg-[var(--primary-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Today action</p>
            <p className="mt-2 text-lg font-semibold">{preview.todayAction.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{preview.todayAction.reason}</p>
            <p className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-[var(--primary)]">
              {minutesLabel(preview.todayAction.durationMinutes, locale)}
            </p>
            <p className="mt-3 text-sm text-[var(--primary)]">Fallback: {preview.fallbackAction}</p>
          </div>

          <div className="mt-4 space-y-4">
            {preview.microActions.map((action) => (
              <div key={action.title} className="rounded-3xl bg-white/70 p-4">
                <p className="font-medium">{action.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--primary)]">Fallback: {action.fallbackAction}</span>
                  <span className="text-[var(--muted)]">{minutesLabel(action.durationMinutes, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
