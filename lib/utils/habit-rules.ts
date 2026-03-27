import type { Locale } from "@/lib/locale";
import type { MicroAction } from "@/lib/validators/habit";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

export function mapGeneratedActionsToPlanInput(actions: MicroAction[]): PlanMicroActionInput[] {
  return actions.slice(0, 3).map((action, index) => ({
    position: index + 1,
    title: action.title,
    details: action.reason,
    durationMinutes: action.durationMinutes,
    fallbackTitle: action.fallbackAction,
    fallbackDetails: "기본 단계가 여전히 버겁다면 더 가벼운 대체 행동을 사용합니다.",
    fallbackDurationMinutes: 1,
  }));
}

export function buildRecoveryPreview(actions: PlanMicroActionInput[], selectedPosition: number): PlanMicroActionInput[] {
  return actions.map((action) => {
    if (action.position !== selectedPosition) {
      return action;
    }

    return {
      ...action,
      title: `더 작은 단계: ${action.title}`,
      details: action.details ?? "다시 시작하기 쉽도록 문턱을 더 낮췄습니다.",
      durationMinutes: Math.max(1, action.durationMinutes - 1),
    };
  });
}

export function prioritizeSelectedMicroAction(actions: PlanMicroActionInput[], selectedPosition: number): PlanMicroActionInput[] {
  const selected = actions.find((action) => action.position === selectedPosition);
  const remaining = actions.filter((action) => action.position !== selectedPosition);

  if (!selected) {
    return actions;
  }

  return [selected, ...remaining].map((action, index) => ({
    ...action,
    position: index + 1,
  }));
}

function clampReviewDuration(value: number) {
  return Math.max(1, Math.min(5, value));
}

function deriveSmallerActionTitle(title: string, locale: Locale = "ko") {
  const normalized = title.trim();

  if (locale === "ko") {
    if (/두 페이지/.test(normalized)) return normalized.replace(/두 페이지/g, "한 페이지");
    if (/한 페이지/.test(normalized)) return "책만 펴고 끝내기";
    if (/두 문장/.test(normalized)) return normalized.replace(/두 문장/g, "한 문장");
    if (/한 문장/.test(normalized)) return "메모 앱만 열기";
    if (/한 줄/.test(normalized)) return normalized.replace(/한 줄/g, "한 번 보기");
    if (/운동화 신고 1분 움직이기/.test(normalized)) return "운동화만 신기";
    if (/1분 움직이기/.test(normalized)) return normalized.replace(/1분 움직이기/g, "운동화만 신기");
    if (/1세트만 하기/.test(normalized)) return normalized.replace(/1세트만 하기/g, "자세만 한 번 잡기");
    if (/스트레칭 한 동작 5번 하기/.test(normalized)) return "스트레칭 자세만 잡기";
    if (/정리하기|치우기|제자리에 두기/.test(normalized)) return "물건 하나만 집어 들기";
    if (/핵심 한 줄 읽기/.test(normalized)) return "공부할 페이지를 펴기";
    if (/꺼내두기|펴두기|갈아입기/.test(normalized)) return normalized.replace(/하기|두기/g, "만 하기");
    return "도구 하나만 꺼내기";
  }

  if (/two pages/i.test(normalized)) return normalized.replace(/two pages/gi, "one page");
  if (/one page/i.test(normalized)) return "Open the book and stop there";
  if (/two sentences/i.test(normalized)) return normalized.replace(/two sentences/gi, "one sentence");
  if (/one sentence/i.test(normalized)) return "Open the notes app";
  if (/one set/i.test(normalized)) return normalized.replace(/one set/gi, "one rep");
  return "Open what you need and stop there";
}

function deriveHarderActionTitle(current: PlanMicroActionInput, locale: Locale = "ko") {
  const normalized = current.title.trim();

  if (locale === "ko") {
    if (/책만 펴고 끝내기/.test(normalized)) return "책을 펴고 한 페이지 읽기";
    if (/메모 앱만 열기/.test(normalized)) return "메모 앱을 열고 한 문장 쓰기";
    if (/공부할 페이지를 펴기/.test(normalized)) return "공부할 페이지를 펴고 핵심 한 줄 읽기";
    if (/운동화만 신기/.test(normalized)) return "운동화 신고 1분 움직이기";
    if (/물건 하나만 집어 들기/.test(normalized)) return "물건 하나 제자리에 두기";
    if (/한 문장/.test(normalized)) return normalized.replace(/한 문장/g, "두 문장");
    if (/한 페이지/.test(normalized)) return normalized.replace(/한 페이지/g, "두 페이지");
    if (/한 번 보기/.test(normalized)) return normalized.replace(/한 번 보기/g, "한 줄 읽기");
    return normalized;
  }

  if (/open the book and stop there/i.test(normalized)) return "Open the book and read one page";
  if (/open the notes app/i.test(normalized)) return "Open the notes app and write one sentence";
  if (/one sentence/i.test(normalized)) return normalized.replace(/one sentence/gi, "two sentences");
  if (/one page/i.test(normalized)) return normalized.replace(/one page/gi, "two pages");
  return normalized;
}

function ensureSmallerFallback(title: string, fallbackTitle: string, locale: Locale = "ko") {
  const normalizedFallback = fallbackTitle.trim();
  if (normalizedFallback && normalizedFallback !== title) {
    return normalizedFallback;
  }

  const derived = deriveSmallerActionTitle(title, locale);
  return derived === title ? (locale === "ko" ? "도구 하나만 꺼내기" : "Open what you need and stop there") : derived;
}

export function getReviewActionSizeLabel(durationMinutes: number, locale: Locale = "ko") {
  if (locale === "ko") {
    if (durationMinutes <= 1) return "아주 작게";
    if (durationMinutes <= 2) return "가볍게";
    if (durationMinutes <= 3) return "보통";
    return "조금 크게";
  }

  if (durationMinutes <= 1) return "Very small";
  if (durationMinutes <= 2) return "Light";
  if (durationMinutes <= 3) return "Steady";
  return "A bit bigger";
}

export function adjustReviewActions(
  actions: PlanMicroActionInput[],
  direction: "easier" | "harder",
  locale: Locale = "ko",
): PlanMicroActionInput[] {
  const current = actions[0];

  if (!current) {
    return actions;
  }

  if (direction === "easier") {
    const nextTitle = ensureSmallerFallback(current.title, current.fallbackTitle, locale);
    const nextFallbackTitle = ensureSmallerFallback(nextTitle, deriveSmallerActionTitle(nextTitle, locale), locale);

    return [
      {
        ...current,
        title: nextTitle,
        details: locale === "ko" ? "지금 바로 하기 쉽게 한 단계 줄였어요." : "We lowered it so it feels easier to start now.",
        durationMinutes: clampReviewDuration(current.durationMinutes - 1),
        fallbackTitle: nextFallbackTitle,
        fallbackDetails: locale === "ko" ? "더 작게 시작할 수 있는 대체 행동이에요." : "An even smaller fallback action.",
        fallbackDurationMinutes: 1,
      },
      ...actions.slice(1),
    ];
  }

  const suggestedNext = actions[1];
  const nextTitle =
    suggestedNext && suggestedNext.title !== current.title
      ? suggestedNext.title
      : deriveHarderActionTitle(current, locale);
  const changed = nextTitle !== current.title || current.durationMinutes < 5;
  const nextFallbackTitle = ensureSmallerFallback(nextTitle, current.title, locale);

  if (!changed) {
    return actions;
  }

  return [
    {
      ...current,
      title: nextTitle,
      details:
        suggestedNext?.details ??
        (locale === "ko" ? "조금 더 해볼 수 있는 크기로 올렸어요." : "We nudged it slightly bigger."),
      durationMinutes: clampReviewDuration(Math.max(current.durationMinutes + 1, suggestedNext?.durationMinutes ?? 0)),
      fallbackTitle: nextFallbackTitle,
      fallbackDetails: current.details ?? (locale === "ko" ? "이전 단계로 다시 낮출 수 있어요." : "You can always drop back to the previous step."),
      fallbackDurationMinutes: clampReviewDuration(Math.min(Math.max(1, current.durationMinutes), 4)),
    },
    ...actions.slice(1),
  ];
}
