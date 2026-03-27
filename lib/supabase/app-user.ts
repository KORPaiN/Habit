import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types";
import { demoBackendIds } from "@/lib/utils/mock-habit";

type ServiceClient = SupabaseClient<Database>;
type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
type UsersTable = {
  upsert: (value: UserInsert, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
};

const DEFAULT_USER_EMAIL = "demo@tinyhabit.dev";
const DEFAULT_USER_NAME = "Demo User";
const DEFAULT_TIMEZONE = "Asia/Seoul";

export function getAppUserId() {
  return process.env.APP_USER_ID ?? demoBackendIds.userId;
}

export async function ensureAppUser(client: ServiceClient) {
  const userId = getAppUserId();

  const user: UserInsert = {
      id: userId,
      email: process.env.APP_USER_EMAIL ?? DEFAULT_USER_EMAIL,
      display_name: process.env.APP_USER_NAME ?? DEFAULT_USER_NAME,
      timezone: process.env.APP_USER_TIMEZONE ?? DEFAULT_TIMEZONE,
    };

  const usersTable = client.from("users" as never) as unknown as UsersTable;
  const { error } = await usersTable.upsert(user, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }

  return userId;
}

export async function syncAuthUserToAppUser(client: ServiceClient, user: User) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : DEFAULT_USER_NAME;

  const userRecord: UserInsert = {
    id: user.id,
    email: user.email ?? `${user.id}@example.invalid`,
    display_name: fullName,
    timezone: DEFAULT_TIMEZONE,
  };

  const usersTable = client.from("users" as never) as unknown as UsersTable;
  const { error } = await usersTable.upsert(userRecord, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }

  return user.id;
}
