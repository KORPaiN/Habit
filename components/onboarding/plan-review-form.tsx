"use client";

import { startTransition, useState } from "react";

import { finalizeOnboardingReview } from "@/app/onboarding/review/actions";
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
  const [actions, setActions] = useState<PlanMicroActionInput[]>(initialActions);
  const [selectedPosition, setSelectedPosition] = useState(1);
  const [isPending, setIsPending] = useState(false);

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

  function removeAction(index: number) {
    setActions((current) =>
      current
        .filter((_, actionIndex) => actionIndex !== index)
        .map((action, actionIndex) => ({
          ...action,
          position: actionIndex + 1,
        })),
    );

    setSelectedPosition(1);
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
      <input type="hidden" name="selectedPosition" value={selectedPosition} />
      <div className="grid gap-4">
        {actions.map((action, index) => (
          <Card key={index} className="bg-[var(--surface-strong)]">
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input
                  type="radio"
                  name={`selected-action-${index}`}
                  checked={selectedPosition === index + 1}
                  onChange={() => setSelectedPosition(index + 1)}
                />
                {locale === "ko" ? "오늘 행동으로 사용" : "Use as today's action"}
              </label>
              {actions.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="text-sm font-medium text-[var(--muted)] transition hover:text-rose-600"
                >
                  {locale === "ko" ? "삭제" : "Remove"}
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              <Input value={action.title} onChange={(event) => updateAction(index, "title", event.target.value)} placeholder={locale === "ko" ? "행동 제목" : "Action title"} />
              <Input value={action.details ?? ""} onChange={(event) => updateAction(index, "details", event.target.value)} placeholder={locale === "ko" ? "왜 이 행동이 작은지" : "Why this action is small"} />
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={String(action.durationMinutes)}
                  onChange={(event) => updateAction(index, "durationMinutes", Number(event.target.value || 1))}
                />
                <Input
                  value={action.fallbackTitle}
                  onChange={(event) => updateAction(index, "fallbackTitle", event.target.value)}
                  placeholder={locale === "ko" ? "대체 행동" : "Fallback action"}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? (locale === "ko" ? "저장 중..." : "Saving...") : locale === "ko" ? "이 플랜으로 시작하기" : "Start with this plan"}
        </Button>
      </div>
    </form>
  );
}
