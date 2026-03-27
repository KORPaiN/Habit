import type { MicroAction, OnboardingInput } from "@/lib/validators/habit";

export const mockOnboardingData: OnboardingInput = {
  goal: "독서 습관 만들기",
  availableMinutes: 5,
  difficulty: "gentle",
  preferredTime: "morning",
  anchor: "아침에 커피를 마신 직후",
};

export const mockPlan: MicroAction[] = [
  {
    title: "책을 펴고 한 페이지만 읽기",
    reason: "한 페이지는 부담 없이 시작하기에 충분히 작습니다.",
    durationMinutes: 2,
    fallbackAction: "한 문장만 읽기",
  },
  {
    title: "도움 되는 문장 하나 표시하기",
    reason: "문장 하나만 표시해도 에너지가 낮은 날에 습관이 눈에 남습니다.",
    durationMinutes: 3,
    fallbackAction: "책 표지만 만지고 끝내기",
  },
  {
    title: "내일 읽을 책 꺼내 두기",
    reason: "다음 단계를 미리 준비하면 내일의 마찰이 줄어듭니다.",
    durationMinutes: 1,
    fallbackAction: "책을 눈에 보이는 곳으로 옮기기",
  },
];

export const demoBackendIds = {
  userId: "11111111-1111-1111-1111-111111111111",
  goalId: "33333333-3333-3333-3333-333333333333",
  planId: "44444444-4444-4444-4444-444444444444",
  microActionId: "55555555-5555-5555-5555-555555555551",
  dailyActionId: "66666666-6666-6666-6666-666666666666",
} as const;

export const mockWeeklySummary = {
  streakDays: 4,
  completedDays: 5,
  difficultMoments: "저녁에는 아침보다 시작이 더 어렵게 느껴졌습니다.",
  helpfulPattern: "커피와 연결했을 때 시작 장벽이 더 낮아졌습니다.",
  nextAdjustment: "당분간 아침 루틴을 유지하고 2분 버전을 계속 보호합니다.",
};
