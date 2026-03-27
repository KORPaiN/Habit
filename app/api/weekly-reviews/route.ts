import { API_RATE_LIMITS, getRequestId, requireAuthenticatedRoute } from "@/lib/security/route-guard";
import { weeklyReviewQuerySchema, weeklyReviewRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { getWeeklyReview, upsertWeeklyReview } from "@/lib/supabase/habit-service";

export async function GET(request: Request) {
  const pathname = new URL(request.url).pathname;
  const requestId = getRequestId(request);

  try {
    const auth = await requireAuthenticatedRoute(request, {
      requestId,
      rateLimits: API_RATE_LIMITS.read,
    });
    const url = new URL(request.url);
    const input = weeklyReviewQuerySchema.parse({
      goalId: url.searchParams.get("goalId"),
      weekStart: url.searchParams.get("weekStart"),
    });
    const result = await getWeeklyReview(auth.client, {
      ...input,
      userId: auth.user.id,
    });

    return ok(result, 200, {
      requestId: auth.requestId,
      headers: auth.rateLimitHeaders,
    });
  } catch (error) {
    return fail(error, { path: pathname, requestId });
  }
}

export async function PUT(request: Request) {
  const pathname = new URL(request.url).pathname;
  const requestId = getRequestId(request);

  try {
    const auth = await requireAuthenticatedRoute(request, {
      requestId,
      sameOrigin: true,
      rateLimits: API_RATE_LIMITS.stateChange,
    });
    const { data } = await readJson(request);
    const input = weeklyReviewRequestSchema.parse(data);
    const result = await upsertWeeklyReview(auth.client, {
      ...input,
      userId: auth.user.id,
    });

    return ok(result, 200, {
      requestId: auth.requestId,
      headers: auth.rateLimitHeaders,
    });
  } catch (error) {
    return fail(error, { path: pathname, requestId });
  }
}
