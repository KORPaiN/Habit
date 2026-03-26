import { assignDailyActionRequestSchema } from "@/lib/schemas/backend";
import { fail, ok, readJson } from "@/lib/server/api";
import { assignDailyAction } from "@/lib/server/habit-service";
import { getSupabaseAdminClient } from "@/lib/services/supabase";

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
