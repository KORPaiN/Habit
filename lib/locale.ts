import { cookies } from "next/headers";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Database } from "@/types";

export const LOCALE_COOKIE = "habit_locale";

export type Locale = "en" | "ko";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();

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
    // Fall back to the locale cookie when auth or Supabase is unavailable.
  }

  return cookieStore.get(LOCALE_COOKIE)?.value === "ko" ? "ko" : "en";
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ko";
}
