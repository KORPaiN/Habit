import { onboardingRequestSchema } from "@/lib/schemas/backend";
import { fail, ok, readJson } from "@/lib/server/api";
import { createOnboardingFlow } from "@/lib/server/habit-service";
import { getSupabaseAdminClient } from "@/lib/services/supabase";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input = onboardingRequestSchema.parse(body);
    const result = await createOnboardingFlow(getSupabaseAdminClient(), input);

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
