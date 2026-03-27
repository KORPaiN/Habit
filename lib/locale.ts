import { cookies } from "next/headers";

export const LOCALE_COOKIE = "habit_locale";

export type Locale = "en" | "ko";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return cookieStore.get(LOCALE_COOKIE)?.value === "ko" ? "ko" : "en";
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ko";
}
