import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/locale";
import { minutesLabel } from "@/lib/utils/habit";
import type { OnboardingInput } from "@/lib/validators/habit";

type OnboardingPreviewProps = {
  values: OnboardingInput;
  locale: Locale;
};

export function OnboardingPreview({ values, locale }: OnboardingPreviewProps) {
  return (
    <Card className="h-full bg-[linear-gradient(180deg,rgba(255,253,249,0.98)_0%,rgba(246,239,231,0.92)_100%)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{locale === "ko" ? "미리보기" : "Preview"}</p>
      <h2 className="mt-3 text-xl font-semibold">{locale === "ko" ? "이번 주를 위한 가벼운 계획" : "A gentle plan for this week"}</h2>
      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "목표" : "Goal"}</dt>
          <dd className="mt-1 font-medium">{values.goal}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "하루 시간" : "Daily time"}</dt>
          <dd className="mt-1 font-medium">{minutesLabel(values.availableMinutes, locale)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "난이도" : "Difficulty"}</dt>
          <dd className="mt-1 font-medium capitalize">{locale === "ko" ? { gentle: "쉬움", steady: "보통", hard: "어려움" }[values.difficulty] : values.difficulty}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "선호 시간대" : "Preferred window"}</dt>
          <dd className="mt-1 font-medium capitalize">{locale === "ko" ? { morning: "아침", afternoon: "오후", evening: "저녁" }[values.preferredTime] : values.preferredTime}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{locale === "ko" ? "앵커" : "Anchor"}</dt>
          <dd className="mt-1 font-medium">{values.anchor}</dd>
        </div>
      </dl>
      <p className="mt-6 rounded-[var(--radius-md)] border border-white/60 bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
        {locale === "ko"
          ? "이 정보를 바탕으로 1~3개의 마이크로 액션을 제안하고, 힘든 날을 위한 대체 행동도 함께 준비합니다."
          : "We will use this to suggest 1 to 3 micro-actions and keep a fallback ready for harder days."}
      </p>
    </Card>
  );
}
