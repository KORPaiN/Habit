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
  const displayName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user?.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null;

  return {
    isAuthenticated: Boolean(user),
    displayName,
    avatarUrl,
    email: user?.email ?? null,
  };
}
