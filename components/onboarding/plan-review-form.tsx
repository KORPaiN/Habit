"use client";

import { useState } from "react";

import {
  adjustOnboardingReviewAction,
  finalizeOnboardingReview,
  regenerateOnboardingReviewPlan,
} from "@/app/onboarding/review/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/locale";
import { getReviewActionSizeLabel } from "@/lib/utils/habit-rules";
import { minutesLabel } from "@/lib/utils/habit";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

type PlanReviewFormProps = {
  locale: Locale;
  initialActions: PlanMicroActionInput[];
  notice?: string;
};

export function PlanReviewForm({ locale, initialActions, notice }: PlanReviewFormProps) {
  const [actions, setActions] = useState<PlanMicroActionInput[]>(initialActions.slice(0, 1));
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
      <div className="grid gap-4">
        {actions.map((action, index) => (
          <Card key={index} className="bg-[var(--surface-strong)] text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                {locale === "ko" ? "오늘 행동" : "Today's action"}
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--foreground-soft)]">
                {locale === "ko"
                  ? `${minutesLabel(action.durationMinutes, locale)} · ${sizeLabel}`
                  : `${minutesLabel(action.durationMinutes, locale)} · ${sizeLabel}`}
              </p>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                  {locale === "ko" ? "할 일" : "Action"}
                </label>
                <Input
                  value={action.title}
                  onChange={(event) => updateAction(index, "title", event.target.value)}
                  placeholder={locale === "ko" ? "오늘 할 일을 적어 주세요" : "Action title"}
                />
              </div>
              <div className="rounded-3xl bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
                  {locale === "ko" ? "대체 행동" : "Fallback"}
                </p>
                <p className="mt-2 text-sm text-[var(--foreground)]">{action.fallbackTitle}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button type="submit" variant="ghost" formAction={makeEasierAction} disabled={isPending}>
          {locale === "ko" ? "더 쉽게" : "Make easier"}
        </Button>
        <Button type="submit" variant="ghost" formAction={makeHarderAction} disabled={isPending}>
          {locale === "ko" ? "조금 더 크게" : "A bit bigger"}
        </Button>
        <Button type="submit" variant="secondary" formAction={regeneratePlanAction} disabled={isPending}>
          {locale === "ko" ? "전체 다시 만들기" : "Regenerate plan"}
        </Button>
        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? (locale === "ko" ? "저장 중..." : "Saving...") : locale === "ko" ? "이 플랜으로 시작하기" : "Start with this plan"}
        </Button>
      </div>
    </form>
  );
}
