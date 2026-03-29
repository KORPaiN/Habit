import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { ApiError } from "@/lib/utils/api";
import { getRateLimitHeaders, consumeRateLimits, type RateLimitRule } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/events";

export const API_RATE_LIMITS = {
  ai: [
    { name: "burst", limit: 8, windowMs: 1000 * 60 * 10 },
    { name: "daily", limit: 20, windowMs: 1000 * 60 * 60 * 24 },
  ],
  stateChange: [{ name: "minute", limit: 30, windowMs: 1000 * 60 }],
  read: [{ name: "minute", limit: 60, windowMs: 1000 * 60 }],
} satisfies Record<string, RateLimitRule[]>;

export type AuthenticatedRouteContext = {
  requestId: string;
  user: User;
  client: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  ip: string | null;
  pathname: string;
  rateLimitHeaders: Record<string, string>;
};

export function getRequestId(request: Request) {
  const existing = request.headers.get("x-request-id")?.trim();

  if (existing) {
    return existing.slice(0, 120);
  }

  return randomUUID();
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  return origin === new URL(request.url).origin;
}

export function assertSameOrigin(request: Request, requestId: string) {
  if (isSameOriginRequest(request)) {
    return;
  }

  logSecurityEvent({
    type: "csrf_blocked",
    level: "warn",
    requestId,
    route: new URL(request.url).pathname,
    ip: getClientIp(request),
    outcome: "blocked",
    statusCode: 403,
  });

  throw new ApiError(403, "Cross-site requests are not allowed.");
}

export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get("x-idempotency-key")?.trim();

  if (!key || key.length < 8 || key.length > 128) {
    throw new ApiError(400, "A valid X-Idempotency-Key header is required.");
  }

  return key;
}

export async function requireAuthenticatedRoute(
  request: Request,
  options?: {
    requestId?: string;
    sameOrigin?: boolean;
    rateLimits?: RateLimitRule[];
  },
): Promise<AuthenticatedRouteContext> {
  const requestId = options?.requestId ?? getRequestId(request);
  const pathname = new URL(request.url).pathname;
  const ip = getClientIp(request);

  if (options?.sameOrigin) {
    assertSameOrigin(request, requestId);
  }

  const client = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    logSecurityEvent({
      type: "unauthenticated_request",
      level: "warn",
      requestId,
      route: pathname,
      ip,
      outcome: "blocked",
      statusCode: 401,
    });

    throw new ApiError(401, "Authentication required.");
  }

  const rateLimitResult =
    options?.rateLimits && options.rateLimits.length > 0
      ? consumeRateLimits(pathname, user.id, options.rateLimits)
      : null;
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (rateLimitResult && !rateLimitResult.allowed) {
    logSecurityEvent({
      type: "rate_limited",
      level: "warn",
      requestId,
      route: pathname,
      userId: user.id,
      ip,
      outcome: "blocked",
      statusCode: 429,
      detail: {
        policy: rateLimitResult.rule.name,
      },
    });

    throw new ApiError(429, "Too many requests. Please try again soon.", {
      headers: rateLimitHeaders,
      code: "rate_limited",
    });
  }

  return {
    requestId,
    user,
    client,
    ip,
    pathname,
    rateLimitHeaders,
  };
}
