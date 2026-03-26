import { onboardingRequestSchema } from "@/lib/validators/backend";
import { fail, ok, readJson } from "@/lib/utils/api";
import { createOnboardingFlow } from "@/lib/supabase/habit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

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
