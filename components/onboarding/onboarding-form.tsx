"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookmarkPlus, CircleHelp, RefreshCw } from "lucide-react";

import { submitOnboarding } from "@/app/onboarding/actions";
import type { HabitReviewMeta } from "@/lib/habit-session";
import type { Locale } from "@/lib/locale";
import { buildCelebrationSuggestion, buildRecipeText } from "@/lib/utils/habit";
import type { BehaviorSwarmCandidate } from "@/lib/validators/habit";
import type { Database } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type OnboardingFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  error?: string;
  savedAnchors: Array<Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "preferred_time">>;
  initialReviewMeta?: HabitReviewMeta;
  isReselect?: boolean;
};

type WizardValues = {
  goal: string;
  desiredOutcome: string;
  motivationNote: string;
  difficulty: "gentle" | "steady" | "hard";
  availableMinutes: number;
  preferredTime: "morning" | "afternoon" | "evening";
  primaryAnchor: string;
  backupAnchors: string[];
  celebrationText: string;
  rehearsalCount: number;
  recipeText: string;
  swarmCandidates: BehaviorSwarmCandidate[];
  selectedBehavior?: BehaviorSwarmCandidate;
  mode: "create" | "reselect";
};

const DRAFT_KEY = "habit_onboarding_wizard_v1";
const STEP_COUNT = 5;
const anchorExamples = ["커피 마신 뒤", "책상에 앉은 뒤", "양치한 뒤", "집에 들어온 뒤"] as const;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? "저장 중" : "완료"}
    </Button>
  );
}

function createInitialValues(meta?: HabitReviewMeta, isReselect = false): WizardValues {
  const primaryAnchor = meta?.primaryAnchor ?? "";
  const selectedBehavior = meta?.selectedBehavior;

  return {
    goal: meta?.goal ?? "",
    desiredOutcome: meta?.desiredOutcome ?? "",
    motivationNote: meta?.motivationNote ?? "",
    difficulty: meta?.difficulty ?? "steady",
    availableMinutes: meta?.availableMinutes ?? 5,
    preferredTime: meta?.preferredTime ?? "morning",
    primaryAnchor,
    backupAnchors: meta?.backupAnchors ?? [],
    celebrationText: meta?.celebrationText ?? buildCelebrationSuggestion(meta?.goal ?? ""),
    rehearsalCount: meta?.rehearsalCount ?? 0,
    recipeText: meta?.recipeText ?? (primaryAnchor && selectedBehavior ? buildRecipeText(primaryAnchor, selectedBehavior.title) : ""),
    swarmCandidates: meta?.swarmCandidates ?? [],
    selectedBehavior,
    mode: isReselect ? "reselect" : "create",
  };
}

function StepPill({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: STEP_COUNT }).map((_, index) => (
        <div
          key={index}
          className={`h-2 flex-1 rounded-full ${index + 1 <= currentStep ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
        />
      ))}
    </div>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[var(--foreground-soft)]">
      {label} {score}
    </span>
  );
}

export function OnboardingForm({
  locale,
  isAuthenticated,
  error,
  savedAnchors,
  initialReviewMeta,
  isReselect = false,
}: OnboardingFormProps) {
  const [values, setValues] = useState<WizardValues>(() => createInitialValues(initialReviewMeta, isReselect));
  const [currentStep, setCurrentStep] = useState(() => (isReselect && initialReviewMeta?.swarmCandidates.length ? 3 : 1));
  const [isGenerating, setIsGenerating] = useState(false);
  const [swarmError, setSwarmError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [backupInput, setBackupInput] = useState("");
  const resolvedDesiredOutcome = values.desiredOutcome.trim() || values.goal.trim();

  const savedCueOptions = useMemo(
    () => [...savedAnchors.map((anchor) => anchor.cue), ...anchorExamples].filter((cue, index, list) => list.indexOf(cue) === index),
    [savedAnchors],
  );

  useEffect(() => {
    if (isReselect && initialReviewMeta) {
      setValues(createInitialValues(initialReviewMeta, true));
      setCurrentStep(initialReviewMeta.swarmCandidates.length ? 3 : 1);
      return;
    }

    const saved = window.localStorage.getItem(DRAFT_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<WizardValues>;
      setValues((current) => ({
        ...current,
        ...parsed,
        swarmCandidates: Array.isArray(parsed.swarmCandidates) ? parsed.swarmCandidates : current.swarmCandidates,
        backupAnchors: Array.isArray(parsed.backupAnchors) ? parsed.backupAnchors.slice(0, 2) : current.backupAnchors,
      }));
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [initialReviewMeta, isReselect]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  }, [values]);

  useEffect(() => {
    if (values.primaryAnchor && values.selectedBehavior) {
      setValues((current) => ({
        ...current,
        recipeText: buildRecipeText(current.primaryAnchor, current.selectedBehavior?.title ?? ""),
      }));
    }
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
      return values.goal.trim().length >= 3;
    }

    if (step === 2) {
      return values.swarmCandidates.length >= 6;
    }

    if (step === 3) {
      return Boolean(values.selectedBehavior);
    }

    if (step === 4) {
      return values.primaryAnchor.trim().length >= 2;
    }

    return true;
  }

  async function generateSwarm(nextStep = 3) {
    if (!isAuthenticated) {
      setSwarmError("로그인 후 후보를 만들 수 있어요.");
      return;
    }

    setIsGenerating(true);
    setSwarmError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/onboarding/swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            goal: values.goal,
            desiredOutcome: resolvedDesiredOutcome,
            motivationNote: values.motivationNote,
            difficulty: values.difficulty,
            availableMinutes: values.availableMinutes,
            preferredTime: values.preferredTime,
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
        setCurrentStep(nextStep);
      } catch (fetchError) {
        setSwarmError(fetchError instanceof Error ? fetchError.message : "후보를 만들지 못했어요.");
      } finally {
        setIsGenerating(false);
      }
    });
  }

  function toggleBackupAnchor(cue: string) {
    setValues((current) => {
      const exists = current.backupAnchors.includes(cue);

      if (exists) {
        return {
          ...current,
          backupAnchors: current.backupAnchors.filter((anchor) => anchor !== cue),
        };
      }

      if (current.backupAnchors.length >= 2 || cue === current.primaryAnchor) {
        return current;
      }

      return {
        ...current,
        backupAnchors: [...current.backupAnchors, cue],
      };
    });
  }

  function addBackupAnchor() {
    const next = backupInput.trim();

    if (!next) {
      return;
    }

    toggleBackupAnchor(next);
    setBackupInput("");
  }

  return (
    <form action={submitOnboarding} className="grid gap-5">
      <input type="hidden" name="goal" value={values.goal} />
      <input type="hidden" name="desiredOutcome" value={resolvedDesiredOutcome} />
      <input type="hidden" name="motivationNote" value={values.motivationNote} />
      <input type="hidden" name="difficulty" value={values.difficulty} />
      <input type="hidden" name="availableMinutes" value={String(values.availableMinutes)} />
      <input type="hidden" name="preferredTime" value={values.preferredTime} />
      <input type="hidden" name="anchor" value={values.primaryAnchor} />
      <input type="hidden" name="backupAnchorsJson" value={JSON.stringify(values.backupAnchors)} />
      <input type="hidden" name="selectedBehaviorJson" value={JSON.stringify(values.selectedBehavior ?? null)} />
      <input type="hidden" name="swarmCandidatesJson" value={JSON.stringify(values.swarmCandidates)} />
      <input type="hidden" name="recipeText" value={values.recipeText} />
      <input type="hidden" name="celebrationText" value={values.celebrationText} />
      <input type="hidden" name="rehearsalCount" value={String(values.rehearsalCount)} />
      <input type="hidden" name="mode" value={values.mode} />

      <Card className="bg-[var(--surface-strong)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {currentStep}/{STEP_COUNT}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {currentStep === 1 && "원하는 변화"}
              {currentStep === 2 && "행동 후보"}
              {currentStep === 3 && "하나 고르기"}
              {currentStep === 4 && "앵커 정하기"}
              {currentStep === 5 && "마무리"}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {currentStep === 1 && "목표와 방향만 적어요."}
              {currentStep === 2 && "아주 작은 후보를 만듭니다."}
              {currentStep === 3 && "가장 하기 쉬운 행동을 고릅니다."}
              {currentStep === 4 && "기억나는 순간을 붙입니다."}
              {currentStep === 5 && "짧게 확인하고 끝냅니다."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/anchors"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/76 px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
            >
              <BookmarkPlus className="h-4 w-4" />
              앵커
            </Link>
            <Link
              href="/onboarding/help"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/76 text-[var(--foreground)] transition hover:bg-white"
              aria-label={locale === "ko" ? "도움말" : "Help"}
            >
              <CircleHelp className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="mt-5">
          <StepPill currentStep={currentStep} />
        </div>
      </Card>

      {currentStep === 1 ? (
        <Card className="bg-[var(--surface-strong)]">
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">목표</label>
              <Input value={values.goal} onChange={(event) => updateValue("goal", event.target.value)} placeholder="예: 독서 습관 만들기" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">원하는 변화</label>
              <Input value={values.desiredOutcome} onChange={(event) => updateValue("desiredOutcome", event.target.value)} placeholder="예: 하루에 책을 조금씩 읽고 싶어요" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">왜 중요한지</label>
              <Input value={values.motivationNote} onChange={(event) => updateValue("motivationNote", event.target.value)} placeholder="짧게 적기" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">난이도</label>
                <Select value={values.difficulty} onChange={(event) => updateValue("difficulty", event.target.value as WizardValues["difficulty"])}>
                  <option value="gentle">가볍게</option>
                  <option value="steady">보통</option>
                  <option value="hard">더 작게</option>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">가능 시간</label>
                <Select value={String(values.availableMinutes)} onChange={(event) => updateValue("availableMinutes", Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 10].map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}분
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">시간대</label>
                <Select
                  value={values.preferredTime}
                  onChange={(event) => updateValue("preferredTime", event.target.value as WizardValues["preferredTime"])}
                >
                  <option value="morning">아침</option>
                  <option value="afternoon">낮</option>
                  <option value="evening">저녁</option>
                </Select>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {currentStep === 2 ? (
        <Card className="bg-[var(--surface-strong)]">
          <div className="grid gap-4">
            <p className="text-sm text-[var(--muted)]">작고 바로 할 수 있는 행동만 보여줍니다.</p>
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
            {!isAuthenticated ? <p className="text-xs text-[var(--muted)]">후보 생성과 저장은 로그인 후 가능합니다.</p> : null}
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ScorePill label="원함" score={candidate.desireScore} />
                    <ScorePill label="가능" score={candidate.abilityScore} />
                    <ScorePill label="효과" score={candidate.impactScore} />
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
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">기본 앵커</label>
              <Input
                value={values.primaryAnchor}
                onChange={(event) => updateValue("primaryAnchor", event.target.value)}
                placeholder="예: 커피 마신 뒤"
              />
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
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">백업 앵커</label>
              <div className="flex gap-2">
                <Input value={backupInput} onChange={(event) => setBackupInput(event.target.value)} placeholder="하나 더 추가" />
                <Button type="button" variant="ghost" onClick={addBackupAnchor}>
                  추가
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {savedCueOptions.map((cue) => {
                  const selected = values.backupAnchors.includes(cue);
                  const disabled = cue === values.primaryAnchor;

                  return (
                    <button
                      key={`backup-${cue}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleBackupAnchor(cue)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? "border border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "border border-white/60 bg-white/78 text-[var(--foreground)] hover:bg-white"
                      }`}
                    >
                      {cue}
                    </button>
                  );
                })}
              </div>
              {values.backupAnchors.length > 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">선택: {values.backupAnchors.join(", ")}</p>
              ) : null}
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
                <p>기본 앵커: {values.primaryAnchor}</p>
                <p>백업 앵커: {values.backupAnchors.length ? values.backupAnchors.join(", ") : "없음"}</p>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">레시피</label>
              <Input value={values.recipeText} onChange={(event) => updateValue("recipeText", event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">축하</label>
              <Input value={values.celebrationText} onChange={(event) => updateValue("celebrationText", event.target.value)} placeholder="예: 좋아, 했다." />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">리허설</label>
              <Select value={String(values.rehearsalCount)} onChange={(event) => updateValue("rehearsalCount", Number(event.target.value))}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((count) => (
                  <option key={count} value={count}>
                    {count}/7
                  </option>
                ))}
              </Select>
            </div>
            {!isAuthenticated ? <p className="text-sm text-[var(--muted)]">저장은 로그인 후 가능합니다.</p> : null}
            {error ? <p className="text-sm text-amber-800">{error}</p> : null}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1}>
          이전
        </Button>
        {stepError ? <p className="text-sm text-amber-800 sm:ml-auto sm:mr-2 sm:self-center">{stepError}</p> : null}
        {currentStep < STEP_COUNT ? (
          <Button
            type="button"
            onClick={async () => {
              if (currentStep === 1) {
                if (!canMoveFromStep(1)) {
                  setStepError("목표를 3글자 이상 적어주세요.");
                  return;
                }

                if (values.swarmCandidates.length >= 6) {
                  setStepError(null);
                  setCurrentStep(3);
                  return;
                }

                await generateSwarm(3);
                return;
              }

              if (!canMoveFromStep(currentStep)) {
                setStepError(currentStep === 3 ? "행동 하나를 골라주세요." : "앵커를 먼저 적어주세요.");
                return;
              }

              setStepError(null);
              setCurrentStep((step) => Math.min(STEP_COUNT, step + 1));
            }}
            disabled={isGenerating}
          >
            {isGenerating ? "후보 만드는 중" : "다음"}
          </Button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}
