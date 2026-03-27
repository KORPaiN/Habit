import { cookies } from "next/headers";
import type { DifficultyLevel } from "@/types";
import type { PlanMicroActionInput } from "@/lib/validators/backend";

const HABIT_SESSION_COOKIE = "habit_session";

export type HabitSession = {
  userId?: string;
  goalId?: string;
  planId?: string;
  microActionId?: string;
  dailyActionId?: string;
  reviewActions?: PlanMicroActionInput[];
  reviewDifficulty?: DifficultyLevel;
};

function getDefaultSession(): HabitSession {
  return {};
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
      (parsed.userId === undefined || typeof parsed.userId === "string") &&
      (parsed.goalId === undefined || typeof parsed.goalId === "string") &&
      (parsed.planId === undefined || typeof parsed.planId === "string") &&
      (parsed.microActionId === undefined || typeof parsed.microActionId === "string") &&
      (parsed.dailyActionId === undefined || typeof parsed.dailyActionId === "string") &&
      (parsed.reviewActions === undefined || Array.isArray(parsed.reviewActions)) &&
      (parsed.reviewDifficulty === undefined || typeof parsed.reviewDifficulty === "string")
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

export async function clearHabitSession() {
  const cookieStore = await cookies();

  cookieStore.delete(HABIT_SESSION_COOKIE);
}
