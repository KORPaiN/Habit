import { microActionSchema, type MicroAction, type OnboardingInput } from "@/lib/schemas/habit";

export async function generateMicroActions(input: OnboardingInput): Promise<MicroAction[]> {
  // TODO: Replace this placeholder with an OpenAI API call and secure env vars.
  const response = [
    {
      title: `Spend ${Math.min(input.availableMinutes, 3)} minutes on the smallest step toward "${input.goal}"`,
      reason: "A tiny, observable action is easier to start than a full session.",
      durationMinutes: Math.min(input.availableMinutes, 3),
      fallbackAction: "Set a 60-second timer and begin anyway.",
    },
    {
      title: `Do one reset action for "${input.goal}"`,
      reason: "Reset actions make returning to the habit feel lighter.",
      durationMinutes: 2,
      fallbackAction: "Touch the tool you need and stop there.",
    },
    {
      title: `Prepare tomorrow's first step for "${input.goal}"`,
      reason: "Preparation lowers resistance for the next attempt.",
      durationMinutes: 3,
      fallbackAction: "Place the tool where you can see it.",
    },
  ];

  return response.map((item) => microActionSchema.parse(item));
}
