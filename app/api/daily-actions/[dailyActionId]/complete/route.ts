import { completeDailyActionRequestSchema } from "@/lib/schemas/backend";
import { fail, ok, readJson } from "@/lib/server/api";
import { completeDailyAction } from "@/lib/server/habit-service";
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
    const input = completeDailyActionRequestSchema.parse(body);
    const result = await completeDailyAction(getSupabaseAdminClient(), dailyActionId, input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
