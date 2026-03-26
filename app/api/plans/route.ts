import { createPlanRequestSchema } from "@/lib/schemas/backend";
import { fail, ok, readJson } from "@/lib/server/api";
import { createPlanVersion } from "@/lib/server/habit-service";
import { getSupabaseAdminClient } from "@/lib/services/supabase";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input = createPlanRequestSchema.parse(body);
    const result = await createPlanVersion(getSupabaseAdminClient(), input);

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
