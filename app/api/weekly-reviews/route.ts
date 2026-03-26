import { weeklyReviewQuerySchema, weeklyReviewRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { getWeeklyReview, upsertWeeklyReview } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = weeklyReviewQuerySchema.parse({
      userId: url.searchParams.get("userId"),
      goalId: url.searchParams.get("goalId"),
      weekStart: url.searchParams.get("weekStart"),
    });
    const result = await getWeeklyReview(getSupabaseAdminClient(), input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readJson(request);
    const input = weeklyReviewRequestSchema.parse(body);
    const result = await upsertWeeklyReview(getSupabaseAdminClient(), input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
