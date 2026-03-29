"use client";

import { useMemo, useState } from "react";

import { finalizeOnboardingReview, regenerateOnboardingReviewPlan } from "@/app/onboarding/review/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HabitReviewMeta } from "@/lib/habit-session";
import type { Locale } from "@/lib/locale";
import { minutesLabel } from "@/lib/utils/habit";
import { getReviewActionSizeLabel } from "@/lib/utils/habit-rules";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

type PlanReviewFormProps = {
  locale: Locale;
  initialActions: PlanMicroActionInput[];
  notice?: string;
  reviewMeta: HabitReviewMeta;
};

function sortReviewOptions(actions: PlanMicroActionInput[]) {
  return [...actions].sort((left, right) => {
    if (left.durationMinutes !== right.durationMinutes) {
      return left.durationMinutes - right.durationMinutes;
    }

    return left.position - right.position;
  });
}

export function PlanReviewForm({ locale, initialActions, notice, reviewMeta }: PlanReviewFormProps) {
  const options = useMemo(() => sortReviewOptions(initialActions).slice(0, 3), [initialActions]);
  const [selectedPosition, setSelectedPosition] = useState<number>(options[0]?.position ?? 1);
  const [isPending, setIsPending] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.position === selectedPosition),
  );
  const currentAction = options[selectedIndex] ?? options[0];
  const easierOption = selectedIndex > 0 ? options[selectedIndex - 1] : undefined;
  const harderOption = selectedIndex < options.length - 1 ? options[selectedIndex + 1] : undefined;
  const sizeLabel = currentAction ? getReviewActionSizeLabel(currentAction.durationMinutes, locale) : "";

  if (!currentAction) {
    return (
      <Card className="bg-[var(--surface-strong)] text-center">
        <p className="text-sm text-[var(--muted)]">검토할 행동이 아직 없어요.</p>
      </Card>
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
      <input type="hidden" name="actionsJson" value={JSON.stringify(initialActions)} />
      <input type="hidden" name="selectedPosition" value={String(currentAction.position)} />

      {notice ? (
        <Card className="bg-[var(--surface-muted)] text-center">
          <p className="text-sm font-medium text-[var(--primary)]">{notice}</p>
        </Card>
      ) : null}

      <Card className="bg-[var(--surface-strong)]">
        <div className="grid gap-2 text-sm leading-6 text-[var(--foreground)]">
          <p>원하는 변화: {reviewMeta.desiredOutcome}</p>
          <p>고른 행동: {reviewMeta.selectedBehavior.title}</p>
          <p>기존 습관: {reviewMeta.primaryAnchor}</p>
          <p>레시피: {reviewMeta.recipeText}</p>
          <p>축하: {reviewMeta.celebrationText}</p>
        </div>
      </Card>

      <Card className="bg-[var(--surface-strong)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">오늘 행동</p>
            <p className="mt-2 text-sm font-medium text-[var(--foreground-soft)]">
              {minutesLabel(currentAction.durationMinutes, locale)} · {sizeLabel}
            </p>
          </div>
          <div className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            {selectedIndex + 1}/{options.length}
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 p-4">
            <p className="text-lg font-semibold">{currentAction.title}</p>
            {currentAction.details ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{currentAction.details}</p> : null}
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-soft)]">대체 행동</p>
            <p className="mt-2 text-sm text-[var(--foreground)]">{currentAction.fallbackTitle}</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button type="button" variant="ghost" onClick={() => easierOption && setSelectedPosition(easierOption.position)} disabled={isPending || !easierOption}>
          쉽게
        </Button>
        <Button type="button" variant="ghost" onClick={() => harderOption && setSelectedPosition(harderOption.position)} disabled={isPending || !harderOption}>
          어렵게
        </Button>
        <Button type="submit" variant="secondary" formAction={regenerateOnboardingReviewPlan} disabled={isPending}>
          다시 만들기
        </Button>
        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? "저장 중" : "이대로 시작"}
        </Button>
      </div>
    </form>
  );
}
