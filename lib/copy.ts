import type { Locale } from "@/lib/locale";

export const commonCopy: Record<Locale, Record<string, string>> = {
  en: {
    brand: "Habit",
    navToday: "Today",
    navOnboarding: "Onboarding",
    navReview: "Weekly review",
    langLabel: "Language",
    langEnglish: "EN",
    langKorean: "KO",
    sourceSupabase: "Supabase",
    sourceMock: "Mock",
  },
  ko: {
    brand: "Habit",
    navToday: "오늘",
    navOnboarding: "온보딩",
    navReview: "주간 리뷰",
    langLabel: "언어",
    langEnglish: "EN",
    langKorean: "KO",
    sourceSupabase: "Supabase",
    sourceMock: "목 데이터",
  },
};
