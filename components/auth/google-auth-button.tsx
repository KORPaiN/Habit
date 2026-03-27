"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/locale";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type GoogleAuthButtonProps = {
  locale: Locale;
  nextPath?: string;
};

export function GoogleAuthButton({ locale, nextPath = "/today" }: GoogleAuthButtonProps) {
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

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
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
            ? "Google로 계속하기"
            : "Continue with Google"}
      </Button>
      {errorMessage ? <p className="text-sm leading-6 text-amber-900">{errorMessage}</p> : null}
    </div>
  );
}
