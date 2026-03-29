"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleHelp, RefreshCw } from "lucide-react";

import { submitOnboarding } from "@/app/onboarding/actions";
import { PlanReviewForm } from "@/components/onboarding/plan-review-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HabitReviewMeta } from "@/lib/habit-session";
import type { Locale } from "@/lib/locale";
import { buildCelebrationSuggestion, buildRecipeText } from "@/lib/utils/habit";
import { ONBOARDING_STEP_COUNT, parseWizardStep, resolveWizardStep } from "@/lib/utils/onboarding-wizard";
import type { PlanMicroActionInput } from "@/lib/validators/backend";
import type { BehaviorSwarmCandidate } from "@/lib/validators/habit";
import type { Database } from "@/types";

type OnboardingFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  error?: string;
  savedAnchors: Array<Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "preferred_time">>;
  initialReviewMeta?: HabitReviewMeta;
  reviewActions?: PlanMicroActionInput[];
  reviewNotice?: string;
  isReselect?: boolean;
  isReviewMode?: boolean;
  resumeDraft?: boolean;
  resumeStep?: number;
};

type WizardValues = {
  goal: string;
  desiredOutcome: string;
  primaryAnchor: string;
  celebrationText: string;
  recipeText: string;
  swarmCandidates: BehaviorSwarmCandidate[];
  selectedBehavior?: BehaviorSwarmCandidate;
  mode: "create" | "reselect";
};

type DraftState = {
  step: number;
  values: WizardValues;
};

const DRAFT_KEY = "habit_onboarding_wizard_v3";
const habitExamples = ["커피 마신 뒤", "양치 뒤", "집에 들어오면", "책상 앞에 앉으면"] as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? "저장 중" : label}
    </Button>
  );
}

function isMeaningfulClientText(value: string) {
  const letters = Array.from(value.trim()).filter((char) => {
    const code = char.codePointAt(0) ?? 0;

    return (
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 0xac00 && code <= 0xd7a3)
    );
  });

  return letters.length >= 2;
}

function createInitialValues(meta?: HabitReviewMeta, isReselect = false): WizardValues {
  const primaryAnchor = meta?.primaryAnchor ?? "";
  const selectedBehavior = meta?.selectedBehavior;

  return {
    goal: meta?.goal ?? "",
    desiredOutcome: meta?.desiredOutcome ?? "",
    primaryAnchor,
    celebrationText: meta?.celebrationText ?? buildCelebrationSuggestion(meta?.goal ?? ""),
    recipeText: meta?.recipeText ?? (primaryAnchor && selectedBehavior ? buildRecipeText(primaryAnchor, selectedBehavior.title) : ""),
    swarmCandidates: meta?.swarmCandidates ?? [],
    selectedBehavior,
    mode: isReselect ? "reselect" : "create",
  };
}

function buildHelpHref(currentStep: number, isReviewMode: boolean, isReselect: boolean) {
  const search = new URLSearchParams({ step: String(currentStep) });
  search.set("resume", "1");

  if (isReviewMode) {
    search.set("review", "1");
  }

  if (isReselect) {
    search.set("reselect", "1");
  }

  return `/onboarding/help?${search.toString()}`;
}

function StepPill({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: ONBOARDING_STEP_COUNT }).map((_, index) => (
        <div
          key={index}
          className={`h-2 flex-1 rounded-full ${index + 1 <= currentStep ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
        />
      ))}
    </div>
  );
}

export function OnboardingForm({
  locale,
  isAuthenticated,
  error,
  savedAnchors,
  initialReviewMeta,
  reviewActions = [],
  reviewNotice,
  isReselect = false,
  isReviewMode = false,
  resumeDraft = false,
  resumeStep,
}: OnboardingFormProps) {
  const [values, setValues] = useState<WizardValues>(() => createInitialValues(initialReviewMeta, isReselect));
  const [currentStep, setCurrentStep] = useState(() =>
    resolveWizardStep({
      resumeStep,
      resumeDraft,
      isReviewMode,
      isReselect,
      hasSwarmCandidates: Boolean(initialReviewMeta?.swarmCandidates.length),
    }),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [swarmError, setSwarmError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);

  const savedCueOptions = useMemo(
    () => [...savedAnchors.map((anchor) => anchor.cue), ...habitExamples].filter((cue, index, list) => list.indexOf(cue) === index),
    [savedAnchors],
  );

  useEffect(() => {
    if (isReviewMode && initialReviewMeta) {
      setValues(createInitialValues(initialReviewMeta, isReselect));
      setCurrentStep(5);
      setHasHydratedDraft(true);
      return;
    }

    if (isReselect && initialReviewMeta) {
      setValues(createInitialValues(initialReviewMeta, true));
      setCurrentStep(initialReviewMeta.swarmCandidates.length ? 3 : 1);
      setHasHydratedDraft(true);
      return;
    }

    if (!resumeDraft) {
      setValues(createInitialValues(initialReviewMeta, false));
      setCurrentStep(resolveWizardStep({ resumeStep, resumeDraft, isReviewMode, isReselect, hasSwarmCandidates: Boolean(initialReviewMeta?.swarmCandidates.length) }));
      setHasHydratedDraft(true);
      return;
    }

    const saved = window.localStorage.getItem(DRAFT_KEY);

    if (!saved) {
      if (resumeStep) {
        setCurrentStep(resumeStep);
      }

      setHasHydratedDraft(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<DraftState>;
      const restoredStep = resolveWizardStep({
        resumeStep,
        resumeDraft,
        draftStep: typeof parsed.step === "number" ? parsed.step : undefined,
        isReviewMode,
        isReselect,
        hasSwarmCandidates: Array.isArray(parsed.values?.swarmCandidates)
          ? parsed.values?.swarmCandidates.length > 0
          : Boolean(initialReviewMeta?.swarmCandidates.length),
      });

      if (parsed.values) {
        const nextValues = parsed.values;
        setValues((current) => ({
          ...current,
          ...nextValues,
          swarmCandidates: Array.isArray(nextValues.swarmCandidates) ? nextValues.swarmCandidates : current.swarmCandidates,
        }));
      }

      setCurrentStep(restoredStep);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
      setCurrentStep(resolveWizardStep({ resumeStep, resumeDraft, isReviewMode, isReselect, hasSwarmCandidates: Boolean(initialReviewMeta?.swarmCandidates.length) }));
    } finally {
      setHasHydratedDraft(true);
    }
  }, [initialReviewMeta, isReselect, isReviewMode, resumeDraft, resumeStep]);

  useEffect(() => {
    if (!hasHydratedDraft || isReviewMode) {
      return;
    }

    const draft: DraftState = {
      step: parseWizardStep(currentStep) ?? 1,
      values,
    };

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [currentStep, hasHydratedDraft, isReviewMode, values]);

  useEffect(() => {
    if (!values.primaryAnchor || !values.selectedBehavior) {
      return;
    }

    setValues((current) => ({
      ...current,
      recipeText: buildRecipeText(current.primaryAnchor, current.selectedBehavior?.title ?? ""),
    }));
  }, [values.primaryAnchor, values.selectedBehavior]);

  function updateValue<Key extends keyof WizardValues>(key: Key, value: WizardValues[Key]) {
    setStepError(null);
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function canMoveFromStep(step: number) {
    if (step === 1) {
      return values.goal.trim().length >= 3 && values.desiredOutcome.trim().length >= 2 && isMeaningfulClientText(values.goal) && isMeaningfulClientText(values.desiredOutcome);
    }

    if (step === 2) {
      return values.swarmCandidates.length >= 6;
    }

    if (step === 3) {
      return Boolean(values.selectedBehavior);
    }

    if (step === 4) {
      return values.primaryAnchor.trim().length >= 2 && isMeaningfulClientText(values.primaryAnchor);
    }

    return values.recipeText.trim().length >= 3 && values.celebrationText.trim().length >= 1;
  }

  async function generateSwarm() {
    if (!isAuthenticated) {
      setSwarmError("로그인 후 후보를 만들 수 있어요.");
      return;
    }

    setIsGenerating(true);
    setSwarmError(null);

    try {
      const response = await fetch("/api/onboarding/swarm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: values.goal,
          desiredOutcome: values.desiredOutcome,
        }),
      });

      const payload = (await response.json()) as { data?: { candidates?: BehaviorSwarmCandidate[] }; error?: string };
      const candidates = payload.data?.candidates;

      if (!response.ok || !candidates) {
        throw new Error(payload.error || "후보를 만들지 못했어요.");
      }

      setValues((current) => ({
        ...current,
        swarmCandidates: candidates,
        selectedBehavior: candidates[0],
      }));
      setStepError(null);
      setCurrentStep(3);
    } catch (fetchError) {
      setSwarmError(fetchError instanceof Error ? fetchError.message : "후보를 만들지 못했어요.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleNextStep() {
    if (currentStep === 1) {
      if (!canMoveFromStep(1)) {
        setStepError("목표와 원하는 변화를 글로 적어주세요.");
        return;
      }

      setStepError(null);
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!canMoveFromStep(2)) {
        setStepError("후보를 먼저 만들어주세요.");
        return;
      }

      setStepError(null);
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (!canMoveFromStep(3)) {
        setStepError("행동 하나를 골라주세요.");
        return;
      }

      setStepError(null);
      setCurrentStep(4);
      return;
    }

    if (currentStep === 4) {
      if (!canMoveFromStep(4)) {
        setStepError("기존 습관을 적어주세요.");
        return;
      }

      setStepError(null);
      setCurrentStep(5);
    }
  }

  const effectiveStep = isReviewMode ? 5 : currentStep;

  return (
    <div className="grid gap-5">
      <Card className="bg-[var(--surface-strong)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {effectiveStep}/{ONBOARDING_STEP_COUNT}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {effectiveStep === 1 && "무엇을 바꾸고 싶나요?"}
              {effectiveStep === 2 && "작은 행동 후보"}
              {effectiveStep === 3 && "하나만 고르기"}
              {effectiveStep === 4 && "기존 습관 붙이기"}
              {effectiveStep === 5 && "마지막 확인"}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {effectiveStep === 1 && "목표와 원하는 변화만 적어요."}
              {effectiveStep === 2 && "바로 할 수 있는 것만 보여줘요."}
              {effectiveStep === 3 && "지금 제일 쉬운 걸 고르면 돼요."}
              {effectiveStep === 4 && "이미 하는 일 뒤에 붙이면 기억하기 쉬워요."}
              {effectiveStep === 5 && "오늘 할 행동만 고르면 끝이에요."}
            </p>
          </div>
          <div className="flex gap-2">
            {effectiveStep === 4 ? (
              <Link
                href="/anchors"
                className="inline-flex min-h-10 items-center rounded-full border border-white/60 bg-white/76 px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
              >
                저장된 기존 습관
              </Link>
            ) : null}
            <Link
              href={buildHelpHref(effectiveStep, isReviewMode, isReselect) as any}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/76 text-[var(--foreground)] transition hover:bg-white"
              aria-label={locale === "ko" ? "도움말" : "Help"}
            >
              <CircleHelp className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="mt-5">
          <StepPill currentStep={effectiveStep} />
        </div>
      </Card>

      {error ? (
        <Card className="border-amber-300 bg-amber-50/90">
          <p className="text-sm text-amber-900">{error}</p>
        </Card>
      ) : null}

      {isReviewMode && initialReviewMeta && reviewActions.length > 0 ? (
        <PlanReviewForm locale={locale} initialActions={reviewActions} notice={reviewNotice} reviewMeta={initialReviewMeta} />
      ) : (
        <form action={submitOnboarding} className="grid gap-5">
          <input type="hidden" name="goal" value={values.goal} />
          <input type="hidden" name="desiredOutcome" value={values.desiredOutcome.trim() || values.goal.trim()} />
          <input type="hidden" name="anchor" value={values.primaryAnchor} />
          <input type="hidden" name="selectedBehaviorJson" value={JSON.stringify(values.selectedBehavior ?? null)} />
          <input type="hidden" name="swarmCandidatesJson" value={JSON.stringify(values.swarmCandidates)} />
          <input type="hidden" name="recipeText" value={values.recipeText} />
          <input type="hidden" name="celebrationText" value={values.celebrationText} />
          <input type="hidden" name="mode" value={values.mode} />

          {currentStep === 1 ? (
            <Card className="bg-[var(--surface-strong)]">
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">시작할 목표</label>
                  <Input value={values.goal} onChange={(event) => updateValue("goal", event.target.value)} placeholder="예: 책 읽는 습관 만들기" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">원하는 변화</label>
                  <Input value={values.desiredOutcome} onChange={(event) => updateValue("desiredOutcome", event.target.value)} placeholder="예: 매일 조금이라도 읽고 싶어요" />
                </div>
              </div>
            </Card>
          ) : null}

          {currentStep === 2 ? (
            <Card className="bg-[var(--surface-strong)]">
              <div className="grid gap-4">
                <p className="text-sm text-[var(--muted)]">부담 없이 바로 할 수 있는 행동만 골라볼게요.</p>
                {values.swarmCandidates.length > 0 ? (
                  <div className="grid gap-3">
                    {values.swarmCandidates.map((candidate) => (
                      <div key={candidate.id ?? candidate.title} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-4 py-3">
                        <p className="font-medium">{candidate.title}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{candidate.details}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {swarmError ? <p className="text-sm text-amber-800">{swarmError}</p> : null}
                <Button type="button" onClick={() => void generateSwarm()} disabled={!canMoveFromStep(1) || isGenerating}>
                  {isGenerating ? "만드는 중" : values.swarmCandidates.length > 0 ? "다시 만들기" : "후보 만들기"}
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {!isAuthenticated ? <p className="text-xs text-[var(--muted)]">후보 생성과 저장은 로그인 후 가능해요.</p> : null}
              </div>
            </Card>
          ) : null}

          {currentStep === 3 ? (
            <Card className="bg-[var(--surface-strong)]">
              <div className="grid gap-3">
                {values.swarmCandidates.map((candidate) => {
                  const isSelected = values.selectedBehavior?.title === candidate.title;

                  return (
                    <button
                      key={candidate.id ?? candidate.title}
                      type="button"
                      onClick={() => updateValue("selectedBehavior", candidate)}
                      className={`rounded-[var(--radius-md)] border p-4 text-left transition ${
                        isSelected ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] bg-white/70 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{candidate.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{candidate.details}</p>
                        </div>
                        <span className="text-sm font-medium text-[var(--primary)]">{candidate.durationMinutes}분</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {currentStep === 4 ? (
            <Card className="bg-[var(--surface-strong)]">
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">기존 습관</label>
                  <Input value={values.primaryAnchor} onChange={(event) => updateValue("primaryAnchor", event.target.value)} placeholder="예: 커피 마신 뒤" />
                  <p className="mt-2 text-xs text-[var(--muted)]">이미 자주 하는 일 하나면 충분해요.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedCueOptions.map((cue) => (
                    <button
                      key={cue}
                      type="button"
                      onClick={() => updateValue("primaryAnchor", cue)}
                      className="rounded-full border border-white/60 bg-white/78 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
                    >
                      {cue}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {currentStep === 5 ? (
            <Card className="bg-[var(--surface-strong)]">
              <div className="grid gap-4">
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">요약</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <p>변화: {values.desiredOutcome}</p>
                    <p>행동: {values.selectedBehavior?.title}</p>
                    <p>기존 습관: {values.primaryAnchor}</p>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">레시피</label>
                  <Input value={values.recipeText} onChange={(event) => updateValue("recipeText", event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">축하 한마디</label>
                  <Input value={values.celebrationText} onChange={(event) => updateValue("celebrationText", event.target.value)} placeholder="예: 좋아, 됐어." />
                </div>
                {!isAuthenticated ? <p className="text-sm text-[var(--muted)]">저장하려면 로그인해주세요.</p> : null}
              </div>
            </Card>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1}>
              이전
            </Button>
            {stepError ? <p className="text-sm text-amber-800 sm:ml-auto sm:mr-2 sm:self-center">{stepError}</p> : null}
            {currentStep < ONBOARDING_STEP_COUNT ? (
              <Button type="button" onClick={() => void handleNextStep()} disabled={isGenerating}>
                {isGenerating ? "만드는 중" : "다음"}
              </Button>
            ) : (
              <SubmitButton label="계획 만들기" />
            )}
          </div>
        </form>
      )}
    </div>
  );
}
