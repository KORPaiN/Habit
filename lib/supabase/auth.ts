import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { syncAuthUserToAppUser } from "@/lib/supabase/app-user";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function getAuthenticatedUser() {
  const client = await getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return user;
}

export async function syncAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  await syncAuthUserToAppUser(getSupabaseAdminClient(), user);
  return user;
}

export async function getAuthShellState() {
  const user = await getAuthenticatedUser();

  return {
    isAuthenticated: Boolean(user),
    email: user?.email ?? null,
  };
}
