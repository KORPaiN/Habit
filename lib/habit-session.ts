import { cookies } from "next/headers";

import type { PlanMicroActionInput } from "@/lib/validators/backend";
import type { BehaviorSwarmCandidate } from "@/lib/validators/habit";

const HABIT_SESSION_COOKIE = "habit_session";

export type HabitReviewMeta = {
  goal: string;
  desiredOutcome: string;
  selectedBehavior: BehaviorSwarmCandidate;
  swarmCandidates: BehaviorSwarmCandidate[];
  primaryAnchor: string;
  recipeText: string;
  celebrationText: string;
  selectedCandidateId?: string;
};

export type HabitSession = {
  userId?: string;
  goalId?: string;
  planId?: string;
  microActionId?: string;
  dailyActionId?: string;
  reviewActions?: PlanMicroActionInput[];
};

function getDefaultSession(): HabitSession {
  return {};
}

function sanitizeSession(input: Partial<HabitSession>): HabitSession {
  return {
    userId: typeof input.userId === "string" ? input.userId : undefined,
    goalId: typeof input.goalId === "string" ? input.goalId : undefined,
    planId: typeof input.planId === "string" ? input.planId : undefined,
    microActionId: typeof input.microActionId === "string" ? input.microActionId : undefined,
    dailyActionId: typeof input.dailyActionId === "string" ? input.dailyActionId : undefined,
    reviewActions: Array.isArray(input.reviewActions) ? input.reviewActions : undefined,
  };
}

export async function getHabitSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(HABIT_SESSION_COOKIE)?.value;

  if (!raw) {
    return getDefaultSession();
  }

  try {
    return sanitizeSession(JSON.parse(raw) as Partial<HabitSession>);
  } catch {
    return getDefaultSession();
  }
}

export async function setHabitSession(session: HabitSession) {
  const cookieStore = await cookies();
  const payload = JSON.stringify(sanitizeSession(session));

  cookieStore.set(HABIT_SESSION_COOKIE, payload, {
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
