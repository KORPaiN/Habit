import { cookies } from "next/headers";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Database } from "@/types";

export const LOCALE_COOKIE = "habit_locale";

export type Locale = "en" | "ko";

export async function getLocale(): Promise<Locale> {
  try {
    const client = await getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (user) {
      const { data, error } = await client.from("users").select("locale").eq("id", user.id).maybeSingle();
      const userLocale = (data as Pick<Database["public"]["Tables"]["users"]["Row"], "locale"> | null)?.locale;

      if (!error && isLocale(userLocale)) {
        return userLocale;
      }
    }
  } catch {
    // 인증 또는 Supabase를 사용할 수 없으면 한국어를 기본값으로 사용합니다.
  }

  await cookies();
  return "ko";
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ko";
}
