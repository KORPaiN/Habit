"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookmarkPlus, CircleHelp } from "lucide-react";

import { submitOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Locale } from "@/lib/locale";
import { mockOnboardingData } from "@/lib/utils/mock-habit";
import type { OnboardingInput } from "@/lib/validators/habit";
import type { Database } from "@/types";

type OnboardingFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  error?: string;
  savedAnchors: Array<Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "preferred_time">>;
};

const DRAFT_KEY = "habit_onboarding_draft";
const anchorExamples = ["아침에 커피를 마신 직후", "집에 가방을 내려놓은 뒤", "저녁 식사를 마친 뒤", "잠들기 전에 책상 앞에 앉으면"] as const;

function OnboardingSubmitButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending
        ? locale === "ko"
          ? "플랜 만드는 중..."
          : "Generating micro-plan..."
        : locale === "ko"
          ? "마이크로 플랜 만들기"
          : "Generate micro-plan"}
    </Button>
  );
}

export function OnboardingForm({ locale, isAuthenticated, error, savedAnchors }: OnboardingFormProps) {
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

  function updateValue<Key extends keyof OnboardingInput>(key: Key, value: OnboardingInput[Key]) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
      <Card className="bg-[var(--surface-strong)] text-center">
        <form action={submitOnboarding} className="space-y-5">
          <div className="flex justify-end gap-2">
            <Link
              href="/anchors"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/76 px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
            >
              <BookmarkPlus className="h-4 w-4" />
              <span>{locale === "ko" ? "앵커 저장" : "Save anchors"}</span>
            </Link>
            <Link
              href="/onboarding/help"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/76 text-[var(--foreground)] transition hover:bg-white"
              aria-label={locale === "ko" ? "온보딩 사용법 보기" : "Open onboarding guide"}
            >
              <CircleHelp className="h-5 w-5" />
            </Link>
          </div>
          <input type="hidden" name="availableMinutes" value={String(values.availableMinutes)} />
          <input type="hidden" name="preferredTime" value={values.preferredTime} />
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
              {locale === "ko" ? "어떤 목표를 시작하고 싶나요?" : "What goal do you want help starting?"}
            </label>
            <Input
              name="goal"
              value={values.goal}
              onChange={(event) => updateValue("goal", event.target.value)}
              placeholder={locale === "ko" ? "예: 독서 습관 만들기" : "Example: build a reading habit"}
            />
          </div>
          <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                {locale === "ko" ? "난이도" : "Perceived difficulty"}
              </label>
            <Select name="difficulty" value={values.difficulty} onChange={(event) => updateValue("difficulty", event.target.value as OnboardingInput["difficulty"])}>
              <option value="gentle">{locale === "ko" ? "쉬움" : "Gentle"}</option>
              <option value="steady">{locale === "ko" ? "보통" : "Steady"}</option>
              <option value="hard">{locale === "ko" ? "어려움" : "Hard"}</option>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
              {locale === "ko" ? "앵커 행동" : "Anchor cue"}
            </label>
            <Input
              name="anchor"
              value={values.anchor}
              onChange={(event) => updateValue("anchor", event.target.value)}
              placeholder={locale === "ko" ? "예: 아침에 커피를 마신 직후" : "Example: right after my morning coffee"}
            />
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {locale === "ko"
                ? "이 행동 뒤에 바로 시작할 수 있게 적어 주세요."
                : "Write the moment after which you'll start the habit."}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {anchorExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => updateValue("anchor", example)}
                  className="rounded-full border border-white/60 bg-white/74 px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-white"
                >
                  {example}
                </button>
              ))}
            </div>
            {savedAnchors.length > 0 ? (
              <div className="mt-4 text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                  {locale === "ko" ? "저장된 앵커" : "Saved anchors"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {savedAnchors.map((anchor) => (
                    <button
                      key={anchor.id}
                      type="button"
                      onClick={() => updateValue("anchor", anchor.cue)}
                      className="rounded-full border border-[var(--primary-soft)] bg-[var(--primary-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-white"
                    >
                      {anchor.cue}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--primary-soft)] p-3.5 text-sm leading-6 text-[var(--primary)]">
            {locale === "ko"
              ? "오늘 한 걸음만 정하면 충분해요."
              : "We keep this short on purpose. You only need enough detail to shape today's first tiny step."}
          </div>
          {error ? (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {error}
            </div>
          ) : null}
          {!isAuthenticated ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              {locale === "ko"
                ? "저장하려면 먼저 Google로 로그인해 주세요."
                : "Sign in with Google first to save this plan. What you typed stays in this browser for now."}
            </div>
          ) : null}
          {isAuthenticated ? (
            <>
              <OnboardingSubmitButton locale={locale} />
              <p className="text-center text-xs leading-5 text-[var(--muted)]">
                {locale === "ko"
                  ? "몇 초 걸릴 수 있어요."
                  : "This can take a few seconds depending on the AI response."}
              </p>
            </>
          ) : null}
        </form>
      </Card>
    
  );
}
