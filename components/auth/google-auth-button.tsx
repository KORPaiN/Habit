"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/locale";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type GoogleAuthButtonProps = {
  locale: Locale;
  nextPath?: string;
  signupLocale?: Locale;
};

export function GoogleAuthButton({ locale, nextPath = "/today", signupLocale }: GoogleAuthButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setErrorMessage(
        locale === "ko"
          ? "Supabase 설정이 없어 Google 로그인을 시작할 수 없습니다."
          : "Supabase is not configured yet, so Google sign-in is unavailable.",
      );
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", nextPath);

    if (signupLocale) {
      redirectTo.searchParams.set("locale", signupLocale);
    }

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" fullWidth onClick={handleClick} disabled={isPending}>
        {isPending
          ? locale === "ko"
            ? "Google로 이동하는 중..."
            : "Opening Google..."
          : locale === "ko"
            ? "Google로 로그인하기"
            : "Continue with Google"}
      </Button>
      {errorMessage ? <p className="text-sm leading-6 text-amber-900">{errorMessage}</p> : null}
    </div>
  );
}
