"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { prepareRecoveryOptions, saveRecoveryChoice, type RecoveryOption } from "@/app/recover/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/locale";
import { minutesLabel } from "@/lib/utils/habit";
import type { MicroAction } from "@/lib/validators/habit";

const failureReasonOptions = [
  {
    value: "too_big",
    label: "It felt too difficult",
    hint: "We will make the next version clearly smaller.",
    labelKo: "너무 어렵게 느껴졌어요",
    hintKo: "다음 버전을 더 분명하게 작게 만들게요.",
  },
  {
    value: "too_tired",
    label: "I was too tired",
    hint: "We will lower effort and friction.",
    labelKo: "너무 피곤했어요",
    hintKo: "필요한 힘과 마찰을 더 낮출게요.",
  },
  {
    value: "forgot",
    label: "I forgot",
    hint: "We will make the step easier to remember.",
    labelKo: "잊어버렸어요",
    hintKo: "더 떠올리기 쉬운 단계로 바꿀게요.",
  },
  {
    value: "schedule_conflict",
    label: "My schedule got in the way",
    hint: "We will reshape it for a tighter day.",
    labelKo: "일정이 겹쳤어요",
    hintKo: "바쁜 하루에도 맞도록 다시 설계할게요.",
  },
  {
    value: "low_motivation",
    label: "Starting felt heavy",
    hint: "We will remove more pressure from the first step.",
    labelKo: "시작이 너무 무겁게 느껴졌어요",
    hintKo: "첫 단계의 압박을 더 줄일게요.",
  },
  {
    value: "other",
    label: "Something else got in the way",
    hint: "We will still make the step gentler.",
    labelKo: "다른 이유가 있었어요",
    hintKo: "그래도 더 부드러운 단계로 바꿀게요.",
  },
] as const;

type RecoveryFlowProps = {
  currentAction: MicroAction;
  goal: string;
  initialReason?: (typeof failureReasonOptions)[number]["value"];
  locale: Locale;
};

export function RecoveryFlow({ currentAction, goal, initialReason = "too_big", locale }: RecoveryFlowProps) {
  const router = useRouter();
  const [failureReason, setFailureReason] = useState<(typeof failureReasonOptions)[number]["value"]>(initialReason);
  const [options, setOptions] = useState<RecoveryOption[]>([]);
  const [selectedPosition, setSelectedPosition] = useState(1);
  const [step, setStep] = useState<"reason" | "options">("reason");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error">("neutral");
  const [isPending, setIsPending] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.position === selectedPosition) ?? options[0],
    [options, selectedPosition],
  );

  async function handleReasonSubmit() {
    setIsPending(true);
    setStatusMessage(null);
    setStatusTone("neutral");

    startTransition(async () => {
      try {
        const result = await prepareRecoveryOptions({ failureReason });
        setOptions(result.options);
        setSelectedPosition(result.options[0]?.position ?? 1);
        setStep("options");
        setStatusMessage(
          locale === "ko"
            ? "더 힘을 내려고 하지 않아도 돼요. 가장 시작하기 쉬운 버전을 고르세요."
            : "You do not need more force. Pick the version that feels easiest to start.",
        );
        setStatusTone("neutral");
      } catch {
        setStatusMessage(
          locale === "ko"
            ? "지금은 AI가 더 작은 단계를 만들 수 없어요. OpenAI 결제 또는 quota를 확인한 뒤 다시 시도해 주세요."
            : "We could not reshape the step just yet. Please try again.",
        );
        setStatusTone("error");
      } finally {
        setIsPending(false);
      }
    });
  }

  async function handleChoiceSubmit() {
    if (!selectedOption) {
      return;
    }

    setIsPending(true);
    setStatusMessage(null);
    setStatusTone("neutral");

    startTransition(async () => {
      try {
        const result = await saveRecoveryChoice({
          failureReason,
          selectedPosition,
          options,
        });

        const params = new URLSearchParams({
          title: result.selectedAction.title,
          reason: result.selectedAction.reason,
          duration: String(result.selectedAction.durationMinutes),
          fallback: result.selectedAction.fallbackAction,
          recovered: "1",
        });

        router.push(`/today?${params.toString()}`);
      } catch {
        setStatusMessage(
          locale === "ko"
            ? "더 작은 단계를 저장하지 못했어요. 다시 시도해 주세요."
            : "We could not save that smaller step. Please try again.",
        );
        setStatusTone("error");
        setIsPending(false);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="bg-[var(--surface-strong)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {locale === "ko" ? "현재 행동" : "Current action"}
        </p>
        <h2 className="mt-3 text-2xl font-semibold">{currentAction.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{currentAction.reason}</p>
        <div className="mt-5 inline-flex rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary)]">
          {minutesLabel(currentAction.durationMinutes, locale)}
        </div>
        <p className="mt-5 rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
          {locale === "ko"
            ? "이건 자책의 순간이 아니라 재설계의 순간이에요. 다음 단계가 시작할 수 있을 만큼만 편하면 됩니다."
            : "This is a redesign moment, not a guilt moment. We only need the next step to feel safe enough to begin."}
        </p>
      </Card>

      <Card className="bg-[linear-gradient(180deg,rgba(247,226,218,0.92)_0%,rgba(255,251,246,0.92)_100%)]">
        {step === "reason" ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">
              {locale === "ko" ? "1단계" : "Step 1"}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {locale === "ko" ? "오늘 이 단계가 왜 어려웠나요?" : "What made this step feel hard today?"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {locale === "ko"
                ? `"${goal}"을 더 엄격하게가 아니라 더 작게 만들기 위해 가장 가까운 이유를 골라주세요.`
                : `Pick the closest reason. We will use it to make ${goal.toLowerCase()} feel smaller, not stricter.`}
            </p>
            <div className="mt-6 space-y-3">
              {failureReasonOptions.map((option) => (
                <label
                  key={option.value}
                  className={`block rounded-3xl border p-4 transition ${
                    failureReason === option.value
                      ? "border-[color:var(--accent)] bg-white shadow-[var(--shadow-sm)]"
                      : "border-white/60 bg-white/70"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="failureReason"
                    value={option.value}
                    checked={failureReason === option.value}
                    onChange={() => setFailureReason(option.value)}
                  />
                  <p className="font-medium text-slate-900">{locale === "ko" ? option.labelKo : option.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{locale === "ko" ? option.hintKo : option.hint}</p>
                </label>
              ))}
            </div>
            <div className="mt-6">
              <Button fullWidth size="lg" onClick={handleReasonSubmit} disabled={isPending}>
                {isPending ? (locale === "ko" ? "더 작게 바꾸는 중..." : "Making it smaller...") : locale === "ko" ? "더 작은 옵션 보기" : "Show smaller options"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">
              {locale === "ko" ? "2단계" : "Step 2"}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {locale === "ko" ? "오늘 할 수 있을 만큼 가장 쉬운 버전을 고르세요" : "Choose the easiest version you could do today"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {locale === "ko"
                ? "작을수록 괜찮아요. 마음을 다잡지 않아도 시작할 수 있는 선택이 가장 좋은 선택입니다."
                : "Smaller counts. The best choice is the one you can actually begin without bracing."}
            </p>
            <div className="mt-6 space-y-3">
              {options.map((option) => (
                <label
                  key={option.position}
                  className={`block rounded-3xl border p-4 transition ${
                    selectedPosition === option.position
                      ? "border-[color:var(--accent)] bg-white shadow-[var(--shadow-sm)]"
                      : "border-white/60 bg-white/70"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="recoveryOption"
                    value={option.position}
                    checked={selectedPosition === option.position}
                    onChange={() => setSelectedPosition(option.position)}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{option.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{option.reason}</p>
                    </div>
                    <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#c2410c]">
                      {minutesLabel(option.durationMinutes, locale)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#9a3412]">
                    {locale === "ko" ? "대체 행동" : "Fallback"}: {option.fallbackAction}
                  </p>
                </label>
              ))}
            </div>
            <div className="mt-6">
              <Button fullWidth size="lg" onClick={handleChoiceSubmit} disabled={isPending || !selectedOption}>
                {isPending ? (locale === "ko" ? "더 작은 단계를 저장하는 중..." : "Saving your smaller step...") : locale === "ko" ? "이 더 작은 단계 사용하기" : "Use this smaller step"}
              </Button>
            </div>
          </>
        )}

        {statusMessage ? (
          <div
            className={
              statusTone === "error"
                ? "mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                : "mt-4 text-sm leading-6 text-slate-700"
            }
          >
            {statusMessage}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
