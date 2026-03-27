"use client";

import { useState } from "react";

import {
  adjustOnboardingReviewAction,
  finalizeOnboardingReview,
  regenerateOnboardingReviewPlan,
} from "@/app/onboarding/review/actions";
import type { HabitReviewMeta } from "@/lib/habit-session";
import type { Locale } from "@/lib/locale";
import { minutesLabel } from "@/lib/utils/habit";
import { getReviewActionSizeLabel } from "@/lib/utils/habit-rules";
import type { PlanMicroActionInput } from "@/lib/validators/backend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PlanReviewFormProps = {
  locale: Locale;
  initialActions: PlanMicroActionInput[];
  notice?: string;
  reviewMeta: HabitReviewMeta;
};

export function PlanReviewForm({ locale, initialActions, notice, reviewMeta }: PlanReviewFormProps) {
  const [actions, setActions] = useState<PlanMicroActionInput[]>(initialActions.slice(0, 3));
  const [isPending, setIsPending] = useState(false);
  const makeEasierAction = adjustOnboardingReviewAction.bind(null, "easier");
  const makeHarderAction = adjustOnboardingReviewAction.bind(null, "harder");
  const regeneratePlanAction = regenerateOnboardingReviewPlan.bind(null);
  const currentAction = actions[0];
  const sizeLabel = currentAction ? getReviewActionSizeLabel(currentAction.durationMinutes, locale) : "";

  function updateAction(index: number, key: keyof PlanMicroActionInput, value: string | number) {
    setActions((current) =>
      current.map((action, actionIndex) =>
        actionIndex === index
          ? {
              ...action,
              [key]:
                key === "durationMinutes" || key === "fallbackDurationMinutes" || key === "position"
                  ? Number(value)
                  : value,
            }
          : action,
      ),
    );
  }

  return (
    <form
      action={finalizeOnboardingReview}
      onSubmit={() => {
        setIsPending(true);
      }}
      className="space-y-4"
    >
      <input
        type="hidden"
        name="actionsJson"
        value={JSON.stringify(actions.filter((action) => action.title.trim() && action.fallbackTitle.trim()))}
      />
      <input type="hidden" name="selectedPosition" value="1" />
      {notice ? (
        <Card className="bg-[var(--surface-muted)] text-center">
          <p className="text-sm font-medium text-[var(--primary)]">{notice}</p>
        </Card>
      ) : null}

      <Card className="bg-[var(--surface-strong)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">최종 레시피</p>
        <div className="mt-4 grid gap-2 text-sm leading-6 text-[var(--foreground)]">
          <p>변화: {reviewMeta.desiredOutcome}</p>
          <p>행동: {reviewMeta.selectedBehavior.title}</p>
          <p>기본 앵커: {reviewMeta.primaryAnchor}</p>
          <p>백업 앵커: {reviewMeta.backupAnchors.length ? reviewMeta.backupAnchors.join(", ") : "없음"}</p>
          <p>레시피: {reviewMeta.recipeText}</p>
          <p>축하: {reviewMeta.celebrationText}</p>
          <p>리허설: {reviewMeta.rehearsalCount}/7</p>
        </div>
      </Card>

      <div className="grid gap-4">
        {actions.slice(0, 1).map((action, index) => (
          <Card key={index} className="bg-[var(--surface-strong)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">오늘 행동</p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground-soft)]">
                  {minutesLabel(action.durationMinutes, locale)} · {sizeLabel}
                </p>
              </div>
              <div className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                fallback 있음
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">행동</label>
                <Input value={action.title} onChange={(event) => updateAction(index, "title", event.target.value)} placeholder="오늘 행동" />
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-soft)]">대체 행동</p>
                <p className="mt-2 text-sm text-[var(--foreground)]">{action.fallbackTitle}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button type="submit" variant="ghost" formAction={makeEasierAction} disabled={isPending}>
          더 쉽게
        </Button>
        <Button type="submit" variant="ghost" formAction={makeHarderAction} disabled={isPending}>
          조금 더
        </Button>
        <Button type="submit" variant="secondary" formAction={regeneratePlanAction} disabled={isPending}>
          다시 만들기
        </Button>
        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? "저장 중" : "이대로 시작"}
        </Button>
      </div>
    </form>
  );
}
