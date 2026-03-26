import { createPlanRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { createPlanVersion } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

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
