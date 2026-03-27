import { cookies } from "next/headers";

import { getAppUserId } from "@/lib/supabase/app-user";

const HABIT_SESSION_COOKIE = "habit_session";

export type HabitSession = {
  userId: string;
  goalId?: string;
  planId?: string;
  microActionId?: string;
  dailyActionId?: string;
};

function getDefaultSession(): HabitSession {
  return {
    userId: getAppUserId(),
  };
}

export async function getHabitSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(HABIT_SESSION_COOKIE)?.value;

  if (!raw) {
    return getDefaultSession();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HabitSession>;

    if (
      typeof parsed.userId === "string" &&
      (parsed.goalId === undefined || typeof parsed.goalId === "string") &&
      (parsed.planId === undefined || typeof parsed.planId === "string") &&
      (parsed.microActionId === undefined || typeof parsed.microActionId === "string") &&
      (parsed.dailyActionId === undefined || typeof parsed.dailyActionId === "string")
    ) {
      return parsed as HabitSession;
    }
  } catch {}

  return getDefaultSession();
}

export async function setHabitSession(session: HabitSession) {
  const cookieStore = await cookies();

  cookieStore.set(HABIT_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function hasActiveHabitSelection(session: HabitSession) {
  return Boolean(session.goalId && session.planId && session.microActionId && session.dailyActionId);
}
