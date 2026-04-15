import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import type { Locale } from "@/lib/locale";
import type { Database } from "@/types";

type ServiceClient = SupabaseClient<Database>;
type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type UsersTable = {
  upsert: (value: UserInsert, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
};

const DEFAULT_USER_NAME = "데모 사용자";
const DEFAULT_TIMEZONE = "Asia/Seoul";
const DEFAULT_LOCALE: Locale = "ko";

export async function syncAuthUserToAppUser(client: ServiceClient, user: User, locale?: Locale) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : DEFAULT_USER_NAME;

  const existingUser = await client.from("users").select("locale").eq("id", user.id).maybeSingle();

  if (existingUser.error) {
    throw new Error(existingUser.error.message);
  }

  const existingLocale = existingUser.data ? (existingUser.data as Pick<UserRow, "locale">).locale : null;

  const userRecord: UserInsert = {
    id: user.id,
    email: user.email ?? `${user.id}@example.invalid`,
    display_name: fullName,
    locale: existingLocale ?? locale ?? DEFAULT_LOCALE,
    timezone: DEFAULT_TIMEZONE,
  };

  const usersTable = client.from("users" as never) as unknown as UsersTable;
  const { error } = await usersTable.upsert(userRecord, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }

  return user.id;
}
