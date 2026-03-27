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
import { minutesLabel } from "@/lib/utils/habit";
import { mockOnboardingData } from "@/lib/utils/mock-habit";
import type { OnboardingInput } from "@/lib/validators/habit";

type OnboardingFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  error?: string;
};

const DRAFT_KEY = "habit_onboarding_draft";
const anchorExamples = [
  "아침에 커피를 마신 직후",
  "퇴근해서 가방을 내려놓은 뒤",
  "저녁 식사를 마친 직후",
  "잠들기 전에 침대에 앉았을 때",
] as const;

function OnboardingSubmitButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending
        ? locale === "ko"
          ? "마이크로 플랜 만드는 중..."
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
      sourceLabel: locale === "ko" ? "입력 기반 미리보기" : "Input preview",
      goalSummary:
        locale === "ko"
          ? `"${normalizedGoal}" 목표를 오늘 끝낼 수 있는 아주 작은 독서 단계로 줄였습니다.`
          : `We shrink "${normalizedGoal}" into a tiny reading step you can actually finish today.`,
      selectedAnchor: values.anchor,
      todayAction: {
        title: locale === "ko" ? "책을 펴고 한 페이지만 읽기" : "Open your book and read one page",
        reason: locale === "ko" ? "한 페이지는 부담 없이 시작하기에 충분히 작습니다." : "One page is small enough to start without friction.",
        durationMinutes: shortDuration,
        fallbackAction: locale === "ko" ? "한 문장만 읽기" : "Read one sentence",
      },
      microActions: [
        {
          title: locale === "ko" ? "책을 펴고 한 페이지만 읽기" : "Open your book and read one page",
          reason: locale === "ko" ? "한 페이지는 부담 없이 시작하기에 충분히 작습니다." : "One page is small enough to start without friction.",
          durationMinutes: shortDuration,
          fallbackAction: locale === "ko" ? "한 문장만 읽기" : "Read one sentence",
        },
        {
          title: locale === "ko" ? "도움 되는 문장 하나 표시하기" : "Highlight one useful line",
          reason: locale === "ko" ? "문장 하나만 표시해도 습관이 눈에 남습니다." : "Marking one line keeps the habit visible.",
          durationMinutes: mediumDuration,
          fallbackAction: locale === "ko" ? "책만 펼치고 끝내기" : "Touch the book and stop",
        },
      ],
      fallbackAction: locale === "ko" ? "한 문장만 읽기" : "Read one sentence",
    };
  }

  if (isWriteGoal) {
    return {
      sourceLabel: locale === "ko" ? "입력 기반 미리보기" : "Input preview",
      goalSummary:
        locale === "ko"
          ? `"${normalizedGoal}" 목표를 오늘 시작할 수 있는 아주 작은 글쓰기 행동으로 바꿉니다.`
          : `We turn "${normalizedGoal}" into a tiny writing action you can start today.`,
      selectedAnchor: values.anchor,
      todayAction: {
        title: locale === "ko" ? "메모 앱을 열고 한 문장 쓰기" : "Open your notes app and write one sentence",
        reason: locale === "ko" ? "한 문장이면 압박 없이 시작하기에 충분합니다." : "One sentence is enough to begin without pressure.",
        durationMinutes: shortDuration,
        fallbackAction: locale === "ko" ? "세 단어만 쓰기" : "Write three words",
      },
      microActions: [
        {
          title: locale === "ko" ? "메모 앱을 열고 한 문장 쓰기" : "Open your notes app and write one sentence",
          reason: locale === "ko" ? "한 문장이면 압박 없이 시작하기에 충분합니다." : "One sentence is enough to begin without pressure.",
          durationMinutes: shortDuration,
          fallbackAction: locale === "ko" ? "세 단어만 쓰기" : "Write three words",
        },
        {
          title: locale === "ko" ? "나중에 이어갈 아이디어 하나 적기" : "List one idea to return to later",
          reason: locale === "ko" ? "아이디어 하나만 남겨도 다음 시작이 쉬워집니다." : "A single idea lowers friction for the next session.",
          durationMinutes: mediumDuration,
          fallbackAction: locale === "ko" ? "문서만 열고 끝내기" : "Open the document and stop",
        },
      ],
      fallbackAction: locale === "ko" ? "세 단어만 쓰기" : "Write three words",
    };
  }

  return {
    sourceLabel: locale === "ko" ? "입력 기반 미리보기" : "Input preview",
    goalSummary:
      locale === "ko"
        ? `"${normalizedGoal}" 목표를 오늘 할 수 있는 가장 작은 첫 단계로 줄였습니다.`
        : `We shrink "${normalizedGoal}" into the smallest useful first step for today.`,
    selectedAnchor: values.anchor,
    todayAction: {
      title: locale === "ko" ? `"${normalizedGoal}"에 필요한 것 하나 준비하기` : `Prepare one thing you need for "${normalizedGoal}"`,
      reason: locale === "ko" ? "준비는 시작 장벽을 낮춥니다." : "Preparation lowers the barrier to starting.",
      durationMinutes: shortDuration,
      fallbackAction: locale === "ko" ? "도구만 만지고 끝내기" : "Touch the tool and stop",
    },
    microActions: [
      {
        title: locale === "ko" ? `"${normalizedGoal}"에 필요한 것 하나 준비하기` : `Prepare one thing you need for "${normalizedGoal}"`,
        reason: locale === "ko" ? "준비는 시작 장벽을 낮춥니다." : "Preparation lowers the barrier to starting.",
        durationMinutes: shortDuration,
        fallbackAction: locale === "ko" ? "도구만 만지고 끝내기" : "Touch the tool and stop",
      },
      {
        title: locale === "ko" ? `"${normalizedGoal}"의 첫 단계 열어 보기` : `Open the first step for "${normalizedGoal}"`,
        reason: locale === "ko" ? "시작점을 눈으로 보면 다시 돌아오기 쉬워집니다." : "Seeing the starting point makes it easier to return.",
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
      <Card className="bg-[var(--surface-strong)]">
        <form action={submitOnboarding} className="space-y-5">
          <div className="rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              {locale === "ko" ? "오늘의 기준" : "Today's boundary"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">
              {locale === "ko"
                ? "몇 분 안에 끝낼 수 있는 행동만 만들어요. 잘하려는 계획보다 실제로 시작할 수 있는 계획이 더 중요합니다."
                : "We only build actions that fit into a few minutes. A plan you can begin matters more than an ambitious one."}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
              {locale === "ko" ? "어떤 목표를 시작하는 데 도움을 받고 싶나요?" : "What goal do you want help starting?"}
            </label>
            <Input
              name="goal"
              value={values.goal}
              onChange={(event) => updateValue("goal", event.target.value)}
              placeholder={locale === "ko" ? "예: 독서 습관 만들기" : "Example: build a reading habit"}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">{locale === "ko" ? "가능한 시간(분)" : "Available minutes"}</label>
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
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">{locale === "ko" ? "체감 난이도" : "Perceived difficulty"}</label>
              <Select name="difficulty" value={values.difficulty} onChange={(event) => updateValue("difficulty", event.target.value as OnboardingInput["difficulty"])}>
                <option value="gentle">{locale === "ko" ? "쉬움" : "Gentle"}</option>
                <option value="steady">{locale === "ko" ? "보통" : "Steady"}</option>
                <option value="hard">{locale === "ko" ? "어려움" : "Hard"}</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">{locale === "ko" ? "선호 시간대" : "Preferred time"}</label>
              <Select name="preferredTime" value={values.preferredTime} onChange={(event) => updateValue("preferredTime", event.target.value as OnboardingInput["preferredTime"])}>
                <option value="morning">{locale === "ko" ? "아침" : "Morning"}</option>
                <option value="afternoon">{locale === "ko" ? "오후" : "Afternoon"}</option>
                <option value="evening">{locale === "ko" ? "저녁" : "Evening"}</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">{locale === "ko" ? "앵커 행동" : "Anchor cue"}</label>
            <Input
              name="anchor"
              value={values.anchor}
              onChange={(event) => updateValue("anchor", event.target.value)}
              placeholder={locale === "ko" ? "예: 아침에 커피를 마신 직후" : "Example: right after my morning coffee"}
            />
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {locale === "ko"
                ? "하루 중 이 행동이 끝나면 바로 작은 습관을 시작하겠다는 기준점을 적어 주세요."
                : "Write the moment after which you'll start the habit."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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
          <div className="rounded-[var(--radius-md)] bg-[var(--primary-soft)] p-4 text-sm leading-6 text-[var(--primary)]">
            {locale === "ko"
              ? "일부러 짧게 묻고 있어요. 오늘의 첫 작은 단계를 만드는 데 필요한 정보만 있으면 충분합니다."
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
                ? "계획을 저장하려면 먼저 Google로 로그인해 주세요. 지금 입력한 내용은 우선 이 브라우저에 저장됩니다."
                : "Sign in with Google first to save this plan. What you typed stays in this browser for now."}
            </div>
          ) : null}
          {isAuthenticated ? (
            <>
              <OnboardingSubmitButton locale={locale} />
              <p className="text-center text-xs leading-5 text-[var(--muted)]">
                {locale === "ko"
                  ? "AI 응답 상태에 따라 몇 초에서 조금 더 걸릴 수 있어요."
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

      <div className="grid gap-6">
        <OnboardingPreview values={values} locale={locale} />
        <Card className="bg-[var(--surface-muted)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                {locale === "ko" ? "입력 기반 플랜 미리보기" : "Input-based plan preview"}
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                {locale === "ko" ? "현재 입력이라면 이런 첫 계획이 만들어집니다." : "This is the kind of first plan your current input will create."}
              </h3>
            </div>
            <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              {preview.sourceLabel}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{preview.goalSummary}</p>

          <div className="mt-5 rounded-[var(--radius-md)] border border-white/60 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              {locale === "ko" ? "선택된 앵커" : "Selected anchor"}
            </p>
            <p className="mt-2 font-medium">{preview.selectedAnchor}</p>
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--primary-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              {locale === "ko" ? "오늘의 행동" : "Today action"}
            </p>
            <p className="mt-2 text-lg font-semibold">{preview.todayAction.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{preview.todayAction.reason}</p>
            <p className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-[var(--primary)]">
              {minutesLabel(preview.todayAction.durationMinutes, locale)}
            </p>
            <p className="mt-3 text-sm text-[var(--primary)]">
              {locale === "ko" ? "대체 행동" : "Fallback"}: {preview.fallbackAction}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {preview.microActions.map((action) => (
              <div key={action.title} className="rounded-[var(--radius-md)] border border-white/60 bg-white/72 p-4">
                <p className="font-medium">{action.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{action.reason}</p>
                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--primary)]">
                    {locale === "ko" ? "대체 행동" : "Fallback"}: {action.fallbackAction}
                  </span>
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
