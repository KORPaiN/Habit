import { failDailyActionRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { failDailyAction } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

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
