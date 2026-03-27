import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/locale";
import type { HabitDecomposition, OnboardingInput } from "@/lib/validators/habit";

type OnboardingPreviewProps = {
  values: OnboardingInput;
  locale: Locale;
  preview: Pick<HabitDecomposition, "goalSummary" | "selectedAnchor" | "todayAction" | "fallbackAction">;
};

export function OnboardingPreview({ values, locale, preview }: OnboardingPreviewProps) {
  return (
    <Card className="h-full bg-[linear-gradient(180deg,rgba(255,253,249,0.98)_0%,rgba(246,239,231,0.92)_100%)] text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
        {locale === "ko" ? "미리보기" : "Preview"}
      </p>
      <h2 className="mt-3 text-xl font-semibold">
        {locale === "ko" ? "이번 주 시작안" : "A gentle plan for this week"}
      </h2>
      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "목표" : "Goal"}</dt>
          <dd className="mt-1 font-medium">{values.goal}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "난이도" : "Difficulty"}</dt>
          <dd className="mt-1 font-medium capitalize">
            {locale === "ko" ? { gentle: "쉬움", steady: "보통", hard: "어려움" }[values.difficulty] : values.difficulty}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "앵커" : "Anchor"}</dt>
          <dd className="mt-1 font-medium">{values.anchor}</dd>
        </div>
      </dl>
      <div className="mt-6 rounded-[var(--radius-md)] border border-white/60 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
          {locale === "ko" ? "입력 요약" : "Summary"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{preview.goalSummary}</p>
      </div>
      <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--primary-soft)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
          {locale === "ko" ? "오늘 행동 예시" : "Today action"}
        </p>
        <p className="mt-2 text-lg font-semibold">{preview.todayAction.title}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{preview.todayAction.reason}</p>
        <p className="mt-3 text-sm text-[var(--primary)]">
          {locale === "ko" ? "대체 행동" : "Fallback"}: {preview.fallbackAction}
        </p>
      </div>
      <p className="mt-6 rounded-[var(--radius-md)] border border-white/60 bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
        {locale === "ko"
          ? "이 정보를 바탕으로 작은 행동과 대체 행동을 만듭니다."
          : "We will use this to suggest 1 to 3 micro-actions and keep a fallback ready for harder days."}
      </p>
    </Card>
  );
}
