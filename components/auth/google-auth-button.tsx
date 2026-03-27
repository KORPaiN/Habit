"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/locale";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type GoogleAuthButtonProps = {
  locale: Locale;
  nextPath?: string;
  signupLocale?: Locale;
  fullWidth?: boolean;
  compact?: boolean;
  autoStart?: boolean;
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 533.5 544.3"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272v104.7h147.1c-6.1 33.8-25.6 63.7-54.2 82.6v68h87.5c51.3-47.2 81.1-116.8 81.1-200z"
        fill="#4285F4"
      />
      <path
        d="M272 544.3c73.5 0 135.4-24.1 180.5-65.8l-87.5-68c-24.3 16.5-55.6 25.9-93 25.9-71.4 0-132-48.2-153.7-113.1H28v71.1C74.2 485.8 166.3 544.3 272 544.3z"
        fill="#34A853"
      />
      <path
        d="M118.3 323.3c-10.9-32.2-10.9-67 0-99.2V153H28c-39 77.6-39 160.7 0 238.3l90.3-68z"
        fill="#FBBC05"
      />
      <path
        d="M272 107.7c39.9-.6 78.4 14.5 108.1 42.3l80.4-80.4C404.9 24 340.7-.9 272 0 166.3 0 74.2 58.5 28 153l90.3 71.1C140 155.9 200.6 107.7 272 107.7z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  locale,
  nextPath = "/today",
  signupLocale,
  fullWidth = true,
  compact = false,
  autoStart = false,
}: GoogleAuthButtonProps) {
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

  useEffect(() => {
    if (!autoStart || isPending || errorMessage) {
      return;
    }

    void handleClick();
  }, [autoStart]);

  return (
    <div className="space-y-3">
      <Button type="button" fullWidth={fullWidth} onClick={handleClick} disabled={isPending} className={compact ? "px-3 py-2.5" : undefined}>
        {compact ? (
          <>
            <GoogleLogo className="h-5 w-5 shrink-0" />
            <span>{isPending ? (locale === "ko" ? "Opening..." : "Opening...") : "Login"}</span>
          </>
        ) : isPending ? (
          locale === "ko" ? "Google로 이동하는 중..." : "Opening Google..."
        ) : locale === "ko" ? (
          <span className="inline-flex items-center gap-2">
            <GoogleLogo className="h-5 w-5 shrink-0" />
            <span>Google로 로그인하기</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <GoogleLogo className="h-5 w-5 shrink-0" />
            <span>Continue with Google</span>
          </span>
        )}
      </Button>
      {errorMessage ? <p className="text-sm leading-6 text-amber-900">{errorMessage}</p> : null}
    </div>
  );
}
