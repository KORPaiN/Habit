import { NextResponse } from "next/server";

import { setHabitSession } from "@/lib/habit-session";
import { syncAuthUserToAppUser } from "@/lib/supabase/app-user";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/today";
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Missing%20auth%20code", request.url));
  }

  const client = await getSupabaseServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=Unable%20to%20load%20user", request.url));
  }

  await syncAuthUserToAppUser(getSupabaseAdminClient(), user);
  await setHabitSession({ userId: user.id });

  return NextResponse.redirect(new URL(next, request.url));
}
