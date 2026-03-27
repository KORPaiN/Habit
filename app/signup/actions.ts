"use server";

import { redirect } from "next/navigation";

import { isLocale } from "@/lib/locale";
import { syncAuthenticatedUser } from "@/lib/supabase/auth";

export async function completeSignupWithLocale(formData: FormData) {
  const localeValue = formData.get("locale");
  const nextValue = formData.get("next");
  const next = typeof nextValue === "string" && nextValue.startsWith("/") ? nextValue : "/onboarding";
  const selectedLocale = typeof localeValue === "string" ? localeValue : null;

  if (!isLocale(selectedLocale)) {
    redirect(`/signup?error=${encodeURIComponent("Please choose a language.")}` as never);
  }

  const user = await syncAuthenticatedUser(selectedLocale);

  if (!user) {
    redirect("/login" as never);
  }

  redirect(next as never);
}
