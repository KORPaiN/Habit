"use server";

import { redirect } from "next/navigation";

import { clearHabitSession } from "@/lib/habit-session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function signOutAction() {
  const client = await getSupabaseServerClient();
  await client.auth.signOut();
  await clearHabitSession();
  redirect("/login");
}
