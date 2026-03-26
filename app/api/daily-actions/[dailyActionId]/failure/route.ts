import { failDailyActionRequestSchema } from "@/lib/schemas/backend";
import { fail, ok, readJson } from "@/lib/server/api";
import { failDailyAction } from "@/lib/server/habit-service";
import { getSupabaseAdminClient } from "@/lib/services/supabase";

interface RouteContext {
  params: Promise<{
    dailyActionId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { dailyActionId } = await context.params;
    const body = await readJson(request);
    const input = failDailyActionRequestSchema.parse(body);
    const result = await failDailyAction(getSupabaseAdminClient(), dailyActionId, input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
