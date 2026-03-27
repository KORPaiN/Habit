import { beginIdempotentRequest, hashIdempotencyPayload } from "@/lib/security/idempotency";
import { API_RATE_LIMITS, getRequestId, requireAuthenticatedRoute, requireIdempotencyKey } from "@/lib/security/route-guard";
import { failDailyActionRequestSchema } from "@/lib/validators/backend";
import { ApiError, fail, ok, readJson } from "@/lib/utils/api";
import { failDailyAction } from "@/lib/supabase/habit-service";

interface RouteContext {
  params: Promise<{
    dailyActionId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  const pathname = new URL(request.url).pathname;
  const requestId = getRequestId(request);

  try {
    const auth = await requireAuthenticatedRoute(request, {
      requestId,
      sameOrigin: true,
      rateLimits: API_RATE_LIMITS.stateChange,
    });
    const { dailyActionId } = await context.params;
    const { data, rawText } = await readJson(request);
    const input = failDailyActionRequestSchema.parse(data);
    const idempotencyKey = requireIdempotencyKey(request);
    const claim = beginIdempotentRequest({
      scope: `${auth.user.id}:${auth.pathname}:${dailyActionId}`,
      key: idempotencyKey,
      bodyHash: hashIdempotencyPayload(rawText),
    });

    if (claim.state === "replay") {
      return ok(claim.response, claim.status, {
        requestId: auth.requestId,
        headers: {
          ...auth.rateLimitHeaders,
          "X-Idempotent-Replay": "true",
        },
      });
    }

    if (claim.state === "conflict") {
      throw new ApiError(409, "The idempotency key is already in use for a different request.");
    }

    try {
      const result = await failDailyAction(auth.client, dailyActionId, {
        ...input,
        userId: auth.user.id,
      });
      claim.commit(result);
      return ok(result, 200, {
        requestId: auth.requestId,
        headers: auth.rateLimitHeaders,
      });
    } catch (error) {
      claim.clear();
      throw error;
    }
  } catch (error) {
    return fail(error, { path: pathname, requestId });
  }
}
