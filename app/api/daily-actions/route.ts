import { assignDailyActionRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { assignDailyAction } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input = assignDailyActionRequestSchema.parse(body);
    const result = await assignDailyAction(getSupabaseAdminClient(), input);

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
