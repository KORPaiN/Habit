import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { syncAuthUserToAppUser } from "@/lib/supabase/app-user";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Locale } from "@/lib/locale";

export async function getAuthenticatedUser() {
  const client = await getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return user;
}

export async function syncAuthenticatedUser(locale?: Locale) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  await syncAuthUserToAppUser(getSupabaseAdminClient(), user, locale);
  return user;
}

export async function getAuthShellState() {
  const user = await getAuthenticatedUser();

  return {
    isAuthenticated: Boolean(user),
    email: user?.email ?? null,
  };
}
