import { NextResponse } from "next/server";

import { isLocale, LOCALE_COOKIE } from "@/lib/locale";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const value = url.searchParams.get("value");
  const redirectTo = url.searchParams.get("redirect") || "/";
  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  if (!isLocale(value)) {
    return response;
  }

  response.cookies.set(LOCALE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
