import { generateBehaviorSwarm } from "@/lib/ai";
import { API_RATE_LIMITS, getRequestId, requireAuthenticatedRoute } from "@/lib/security/route-guard";
import { fail, ok, readJson } from "@/lib/utils/api";
import { behaviorSwarmRequestSchema } from "@/lib/validators/backend";

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  const requestId = getRequestId(request);

  try {
    const auth = await requireAuthenticatedRoute(request, {
      requestId,
      sameOrigin: true,
      rateLimits: API_RATE_LIMITS.ai,
    });
    const { data } = await readJson(request);
    const input = behaviorSwarmRequestSchema.parse(data);
    const candidates = await generateBehaviorSwarm(
      {
        ...input,
        motivationNote: input.motivationNote ?? "",
      },
      {
      locale: "ko",
      userId: auth.user.id,
      },
    );

    return ok({ candidates }, 200, {
      requestId: auth.requestId,
      headers: auth.rateLimitHeaders,
    });
  } catch (error) {
    return fail(error, { path: pathname, requestId });
  }
}
