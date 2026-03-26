"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { prepareRecoveryOptions, saveRecoveryChoice, type RecoveryOption } from "@/app/recover/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { minutesLabel } from "@/lib/utils/habit";
import type { MicroAction } from "@/lib/validators/habit";

const failureReasonOptions = [
  {
    value: "too_big",
    label: "It felt too difficult",
    hint: "We will make the next version clearly smaller.",
  },
  {
    value: "too_tired",
    label: "I was too tired",
    hint: "We will lower effort and friction.",
  },
  {
    value: "forgot",
    label: "I forgot",
    hint: "We will make the step easier to remember.",
  },
  {
    value: "schedule_conflict",
    label: "My schedule got in the way",
    hint: "We will reshape it for a tighter day.",
  },
  {
    value: "low_motivation",
    label: "Starting felt heavy",
    hint: "We will remove more pressure from the first step.",
  },
  {
    value: "other",
    label: "Something else got in the way",
    hint: "We will still make the step gentler.",
  },
] as const;

type RecoveryFlowProps = {
  currentAction: MicroAction;
  goal: string;
  initialReason?: (typeof failureReasonOptions)[number]["value"];
};

export function RecoveryFlow({ currentAction, goal, initialReason = "too_big" }: RecoveryFlowProps) {
  const router = useRouter();
  const [failureReason, setFailureReason] = useState<(typeof failureReasonOptions)[number]["value"]>(initialReason);
  const [options, setOptions] = useState<RecoveryOption[]>([]);
  const [selectedPosition, setSelectedPosition] = useState(1);
  const [step, setStep] = useState<"reason" | "options">("reason");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.position === selectedPosition) ?? options[0],
    [options, selectedPosition],
  );

  async function handleReasonSubmit() {
    setIsPending(true);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const result = await prepareRecoveryOptions({ failureReason });
        setOptions(result.options);
        setSelectedPosition(result.options[0]?.position ?? 1);
        setStep("options");
        setStatusMessage("You do not need more force. Pick the version that feels easiest to start.");
      } catch {
        setStatusMessage("We could not reshape the step just yet. Please try again.");
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
        setStatusMessage("We could not save that smaller step. Please try again.");
        setIsPending(false);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Current action</p>
        <h2 className="mt-3 text-2xl font-semibold">{currentAction.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{currentAction.reason}</p>
        <div className="mt-5 inline-flex rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary)]">
          {minutesLabel(currentAction.durationMinutes)}
        </div>
        <p className="mt-5 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
          This is a redesign moment, not a guilt moment. We only need the next step to feel safe enough to begin.
        </p>
      </Card>

      <Card className="bg-[var(--danger-soft)]">
        {step === "reason" ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">Step 1</p>
            <h2 className="mt-3 text-2xl font-semibold">What made this step feel hard today?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Pick the closest reason. We will use it to make {goal.toLowerCase()} feel smaller, not stricter.
            </p>
            <div className="mt-6 space-y-3">
              {failureReasonOptions.map((option) => (
                <label
                  key={option.value}
                  className={`block rounded-3xl border p-4 transition ${
                    failureReason === option.value ? "border-[#fb923c] bg-white" : "border-white/60 bg-white/70"
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
              <Button fullWidth onClick={handleReasonSubmit} disabled={isPending}>
                {isPending ? "Making it smaller..." : "Show smaller options"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a3412]">Step 2</p>
            <h2 className="mt-3 text-2xl font-semibold">Choose the easiest version you could do today</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Smaller counts. The best choice is the one you can actually begin without bracing.
            </p>
            <div className="mt-6 space-y-3">
              {options.map((option) => (
                <label
                  key={option.position}
                  className={`block rounded-3xl border p-4 transition ${
                    selectedPosition === option.position ? "border-[#fb923c] bg-white" : "border-white/60 bg-white/70"
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
                      {minutesLabel(option.durationMinutes)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#9a3412]">Fallback: {option.fallbackAction}</p>
                </label>
              ))}
            </div>
            <div className="mt-6">
              <Button fullWidth onClick={handleChoiceSubmit} disabled={isPending || !selectedOption}>
                {isPending ? "Saving your smaller step..." : "Use this smaller step"}
              </Button>
            </div>
          </>
        )}

        {statusMessage ? <p className="mt-4 text-sm leading-6 text-slate-700">{statusMessage}</p> : null}
      </Card>
    </div>
  );
}
