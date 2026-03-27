"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { prepareRecoveryOptions, saveRecoveryChoice, type RecoveryOption } from "@/app/recover/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HabitReviewMeta } from "@/lib/habit-session";
import type { Locale } from "@/lib/locale";
import type { MicroAction } from "@/lib/validators/habit";

const failureReasonOptions = [
  {
    value: "forgot",
    label: "한 번 잊었어요",
    hint: "신호를 더 잘 보이게 바꿉니다.",
  },
  {
    value: "too_big",
    label: "너무 컸어요",
    hint: "더 작은 행동으로 줄입니다.",
  },
  {
    value: "forgot_often",
    label: "자주 잊어요",
    hint: "백업 앵커로 바꾸고 다시 연습합니다.",
  },
  {
    value: "not_wanted",
    label: "이건 원치 않아요",
    hint: "행동을 다시 고릅니다.",
  },
] as const;

type RecoveryFlowProps = {
  currentAction: MicroAction;
  goal: string;
  initialReason?: (typeof failureReasonOptions)[number]["value"];
  locale: Locale;
  reviewMeta?: HabitReviewMeta;
};

export function RecoveryFlow({ currentAction, goal, initialReason = "too_big", locale, reviewMeta }: RecoveryFlowProps) {
  const router = useRouter();
  const [failureReason, setFailureReason] = useState<(typeof failureReasonOptions)[number]["value"]>(initialReason);
  const [options, setOptions] = useState<RecoveryOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [step, setStep] = useState<"reason" | "options">("reason");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error">("neutral");
  const [isPending, setIsPending] = useState(false);

  const selectedOption = useMemo(() => options.find((option) => option.id === selectedId) ?? options[0], [options, selectedId]);

  async function handleReasonSubmit() {
    setIsPending(true);
    setStatusMessage(null);
    setStatusTone("neutral");

    startTransition(async () => {
      try {
        const result = await prepareRecoveryOptions({ failureReason });
        setOptions(result.options);
        setSelectedId(result.options[0]?.id ?? "");
        setStep("options");
        setStatusMessage(
          failureReason === "not_wanted"
            ? "지금 맞는 행동으로 다시 고를 수 있어요."
            : failureReason === "forgot_often"
              ? "앵커를 바꾸고 다시 리허설해요."
              : failureReason === "forgot"
                ? "신호를 더 잘 보이게 바꿔요."
                : "오늘 할 수 있는 더 작은 버전을 고르세요.",
        );
        setStatusTone("neutral");
      } catch {
        setStatusMessage(locale === "ko" ? "복구 옵션을 만들지 못했어요. 잠시 후 다시 시도해 주세요." : "We could not prepare recovery options.");
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
          selectedId: selectedOption.id,
          options,
        });

        if (result.redirectPath) {
          router.push(result.redirectPath as never);
          return;
        }

        if (selectedOption.mode === "anchor_shift") {
          router.push("/today?recovered=1");
          return;
        }

        const params = new URLSearchParams({
          title: result.selectedAction?.title ?? currentAction.title,
          reason: result.selectedAction?.reason ?? currentAction.reason,
          duration: String(result.selectedAction?.durationMinutes ?? currentAction.durationMinutes),
          fallback: result.selectedAction?.fallbackAction ?? currentAction.fallbackAction,
          recovered: "1",
        });

        router.push(`/today?${params.toString()}`);
      } catch {
        setStatusMessage("복구 저장에 실패했어요.");
        setStatusTone("error");
        setIsPending(false);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="bg-[var(--surface-strong)] text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">현재 행동</p>
        <h2 className="mt-3 text-2xl font-semibold">{currentAction.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{currentAction.reason}</p>
        {reviewMeta ? (
          <div className="mt-5 rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
            <p>목표: {goal}</p>
            <p>앵커: {reviewMeta.primaryAnchor}</p>
            <p>백업: {reviewMeta.backupAnchors.length ? reviewMeta.backupAnchors.join(", ") : "없음"}</p>
          </div>
        ) : null}
      </Card>

      <Card className="bg-[linear-gradient(180deg,rgba(247,226,218,0.92)_0%,rgba(255,251,246,0.92)_100%)] text-center">
        {step === "reason" ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">1단계</p>
            <h2 className="mt-3 text-2xl font-semibold">무엇이 막혔나요?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">가장 가까운 이유를 하나 고르세요.</p>
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
                  <p className="font-medium text-slate-900">{option.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{option.hint}</p>
                </label>
              ))}
            </div>
            <div className="mt-6">
              <Button fullWidth size="lg" onClick={handleReasonSubmit} disabled={isPending}>
                {isPending ? "불러오는 중" : "다음"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">2단계</p>
            <h2 className="mt-3 text-2xl font-semibold">
              {failureReason === "not_wanted" ? "다시 고르기" : failureReason === "too_big" ? "더 작은 버전" : "앵커 고르기"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">{statusMessage}</p>
            <div className="mt-6 space-y-3">
              {options.map((option) => (
                <label
                  key={option.id}
                  className={`block rounded-3xl border p-4 text-left transition ${
                    selectedId === option.id ? "border-[color:var(--accent)] bg-white shadow-[var(--shadow-sm)]" : "border-white/60 bg-white/70"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="recoveryOption"
                    value={option.id}
                    checked={selectedId === option.id}
                    onChange={() => setSelectedId(option.id)}
                  />
                  <p className="font-medium text-slate-900">{option.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{option.reason}</p>
                  {option.mode === "smaller_action" ? (
                    <p className="mt-2 text-sm text-[#9a3412]">대체 행동: {option.fallbackAction}</p>
                  ) : null}
                </label>
              ))}
            </div>
            <div className="mt-6">
              <Button fullWidth size="lg" onClick={handleChoiceSubmit} disabled={isPending || !selectedOption}>
                {isPending ? "저장 중" : failureReason === "not_wanted" ? "다시 고르기" : "이걸로 바꾸기"}
              </Button>
            </div>
          </>
        )}

        {statusTone === "error" && statusMessage ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{statusMessage}</div>
        ) : null}
      </Card>
    </div>
  );
}
