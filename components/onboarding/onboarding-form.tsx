"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitOnboarding } from "@/app/onboarding/actions";
import { OnboardingPreview } from "@/components/onboarding/onboarding-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Locale } from "@/lib/locale";
import { mockOnboardingData } from "@/lib/utils/mock-habit";
import type { OnboardingInput } from "@/lib/validators/habit";

type OnboardingFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  error?: string;
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

function buildPreviewPlan(values: OnboardingInput, locale: Locale) {
  const normalizedGoal = values.goal.trim() || mockOnboardingData.goal;
  const lowerGoal = normalizedGoal.toLowerCase();
  const isReadGoal = /read|book|독서|책/.test(lowerGoal);
  const isWriteGoal = /write|note|journal|글|기록|메모/.test(lowerGoal);
  const shortDuration = values.difficulty === "hard" ? 1 : Math.min(2, values.availableMinutes);
  const mediumDuration = values.difficulty === "hard" ? 1 : Math.min(3, values.availableMinutes);

  if (isReadGoal) {
    return {
      sourceLabel: locale === "ko" ? "입력 미리보기" : "Input preview",
      goalSummary:
        locale === "ko"
          ? `"${normalizedGoal}"을 오늘 읽을 수 있는 작은 단계로 줄였어요.`
          : `We shrink "${normalizedGoal}" into a tiny reading step you can actually finish today.`,
      selectedAnchor: values.anchor,
      todayAction: {
        title: locale === "ko" ? "책을 펴고 한 페이지 읽기" : "Open your book and read one page",
        reason: locale === "ko" ? "한 페이지면 바로 시작할 수 있어요." : "One page is small enough to start without friction.",
        durationMinutes: shortDuration,
        fallbackAction: locale === "ko" ? "한 문장만 읽기" : "Read one sentence",
      },
      microActions: [
        {
          title: locale === "ko" ? "책을 펴고 한 페이지 읽기" : "Open your book and read one page",
          reason: locale === "ko" ? "한 페이지면 바로 시작할 수 있어요." : "One page is small enough to start without friction.",
          durationMinutes: shortDuration,
          fallbackAction: locale === "ko" ? "한 문장만 읽기" : "Read one sentence",
        },
        {
          title: locale === "ko" ? "마음에 든 한 줄 표시하기" : "Highlight one useful line",
          reason: locale === "ko" ? "한 줄만 표시해도 흐름이 이어져요." : "Marking one line keeps the habit visible.",
          durationMinutes: mediumDuration,
          fallbackAction: locale === "ko" ? "책만 펼치고 끝내기" : "Touch the book and stop",
        },
      ],
      fallbackAction: locale === "ko" ? "한 문장만 읽기" : "Read one sentence",
    };
  }

  if (isWriteGoal) {
    return {
      sourceLabel: locale === "ko" ? "입력 미리보기" : "Input preview",
      goalSummary:
        locale === "ko"
          ? `"${normalizedGoal}"을 오늘 쓸 수 있는 작은 단계로 줄였어요.`
          : `We turn "${normalizedGoal}" into a tiny writing action you can start today.`,
      selectedAnchor: values.anchor,
      todayAction: {
        title: locale === "ko" ? "메모 앱을 열고 한 문장 쓰기" : "Open your notes app and write one sentence",
        reason: locale === "ko" ? "한 문장이면 시작하기 충분해요." : "One sentence is enough to begin without pressure.",
        durationMinutes: shortDuration,
        fallbackAction: locale === "ko" ? "단어 세 개 쓰기" : "Write three words",
      },
      microActions: [
        {
          title: locale === "ko" ? "메모 앱을 열고 한 문장 쓰기" : "Open your notes app and write one sentence",
          reason: locale === "ko" ? "한 문장이면 시작하기 충분해요." : "One sentence is enough to begin without pressure.",
          durationMinutes: shortDuration,
          fallbackAction: locale === "ko" ? "단어 세 개 쓰기" : "Write three words",
        },
        {
          title: locale === "ko" ? "나중에 이어갈 아이디어 하나 적기" : "List one idea to return to later",
          reason: locale === "ko" ? "아이디어 하나면 다음 시작이 쉬워져요." : "A single idea lowers friction for the next session.",
          durationMinutes: mediumDuration,
          fallbackAction: locale === "ko" ? "문서만 열고 끝내기" : "Open the document and stop",
        },
      ],
      fallbackAction: locale === "ko" ? "단어 세 개 쓰기" : "Write three words",
    };
  }

  return {
    sourceLabel: locale === "ko" ? "입력 미리보기" : "Input preview",
    goalSummary:
      locale === "ko"
        ? `"${normalizedGoal}"을 오늘 할 수 있는 작은 단계로 줄였어요.`
        : `We shrink "${normalizedGoal}" into the smallest useful first step for today.`,
    selectedAnchor: values.anchor,
    todayAction: {
      title: locale === "ko" ? `"${normalizedGoal}"에 필요한 것 하나 준비하기` : `Prepare one thing you need for "${normalizedGoal}"`,
      reason: locale === "ko" ? "준비부터 하면 시작이 쉬워져요." : "Preparation lowers the barrier to starting.",
      durationMinutes: shortDuration,
      fallbackAction: locale === "ko" ? "도구만 만지고 끝내기" : "Touch the tool and stop",
    },
    microActions: [
      {
        title: locale === "ko" ? `"${normalizedGoal}"에 필요한 것 하나 준비하기` : `Prepare one thing you need for "${normalizedGoal}"`,
        reason: locale === "ko" ? "준비부터 하면 시작이 쉬워져요." : "Preparation lowers the barrier to starting.",
        durationMinutes: shortDuration,
        fallbackAction: locale === "ko" ? "도구만 만지고 끝내기" : "Touch the tool and stop",
      },
      {
        title: locale === "ko" ? `"${normalizedGoal}"의 첫 단계 열어 보기` : `Open the first step for "${normalizedGoal}"`,
        reason: locale === "ko" ? "시작점을 보면 다시 하기 쉬워져요." : "Seeing the starting point makes it easier to return.",
        durationMinutes: mediumDuration,
        fallbackAction: locale === "ko" ? "도구만 바라보고 끝내기" : "Look at the tool and stop",
      },
    ],
    fallbackAction: locale === "ko" ? "도구만 만지고 끝내기" : "Touch the tool and stop",
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
      <Card className="bg-[var(--surface-strong)] text-center">
        <form action={submitOnboarding} className="space-y-5">
          <input type="hidden" name="availableMinutes" value={String(values.availableMinutes)} />
          <input type="hidden" name="preferredTime" value={values.preferredTime} />
          <div className="rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              {locale === "ko" ? "오늘의 기준" : "Today's boundary"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">
              {locale === "ko"
                ? "오늘 바로 시작할 수 있는 크기로 만듭니다."
                : "We only build actions that fit into a few minutes. A plan you can begin matters more than an ambitious one."}
            </p>
          </div>
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
          ) : (
            <Link href="/login?next=%2Fonboarding">
              <Button type="button" fullWidth>
                {locale === "ko" ? "Google로 로그인" : "Sign in with Google"}
              </Button>
            </Link>
          )}
        </form>
      </Card>

      <OnboardingPreview values={values} locale={locale} preview={preview} />
    </>
  );
}
