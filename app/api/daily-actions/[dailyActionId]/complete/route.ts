import { completeDailyActionRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { completeDailyAction } from "@/lib/supabase/habit-service";
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
    const input = completeDailyActionRequestSchema.parse(body);
    const result = await completeDailyAction(getSupabaseAdminClient(), dailyActionId, input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
