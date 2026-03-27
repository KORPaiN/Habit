"use client";

import { useState } from "react";

import { adjustOnboardingReviewDifficulty, finalizeOnboardingReview } from "@/app/onboarding/review/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/locale";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

type PlanReviewFormProps = {
  locale: Locale;
  initialActions: PlanMicroActionInput[];
};

export function PlanReviewForm({ locale, initialActions }: PlanReviewFormProps) {
  const [actions, setActions] = useState<PlanMicroActionInput[]>(initialActions.slice(0, 1));
  const [isPending, setIsPending] = useState(false);
  const makeEasierAction = adjustOnboardingReviewDifficulty.bind(null, "easier");
  const makeHarderAction = adjustOnboardingReviewDifficulty.bind(null, "harder");

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
      <input type="hidden" name="actionsJson" value={JSON.stringify(actions.filter((action) => action.title.trim() && action.fallbackTitle.trim()))} />
      <input type="hidden" name="selectedPosition" value="1" />
      <div className="grid gap-4">
        {actions.map((action, index) => (
          <Card key={index} className="bg-[var(--surface-strong)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                {locale === "ko" ? "오늘 시작할 행동" : "Today's action"}
              </p>
            </div>
            <div className="mt-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                  {locale === "ko" ? "행동" : "Action"}
                </label>
                <Input value={action.title} onChange={(event) => updateAction(index, "title", event.target.value)} placeholder={locale === "ko" ? "행동 제목" : "Action title"} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          variant="ghost"
          formAction={makeEasierAction}
          disabled={isPending}
        >
          {locale === "ko" ? "더 쉽게" : "Easier"}
        </Button>
        <Button
          type="submit"
          variant="ghost"
          formAction={makeHarderAction}
          disabled={isPending}
        >
          {locale === "ko" ? "더 어렵게" : "Harder"}
        </Button>
        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? (locale === "ko" ? "저장 중..." : "Saving...") : locale === "ko" ? "이 플랜으로 시작하기" : "Start with this plan"}
        </Button>
      </div>
    </form>
  );
}
