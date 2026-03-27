import { z } from "zod";

const vagueActionPatterns = [
  /do your best/i,
  /make progress/i,
  /work on/i,
  /keep going/i,
  /try harder/i,
  /be better/i,
  /stay consistent/i,
  /practice/i,
  /spend time/i,
  /focus on/i,
  /move forward/i,
];

function isConcreteAction(value: string) {
  return !vagueActionPatterns.some((pattern) => pattern.test(value));
}

export const onboardingSchema = z.object({
  goal: z.string().min(3, "Please enter a goal you care about."),
  availableMinutes: z.coerce.number().min(1).max(30),
  difficulty: z.enum(["gentle", "steady", "hard"]),
  preferredTime: z.enum(["morning", "afternoon", "evening"]),
  anchor: z.string().min(2, "Please enter an anchor cue.").max(120),
});

export const microActionSchema = z.object({
  title: z.string().min(3).refine(isConcreteAction, "Action must be concrete and observable."),
  reason: z.string().min(3),
  durationMinutes: z.number().min(1).max(5),
  fallbackAction: z.string().min(3).refine(isConcreteAction, "Fallback action must be concrete and observable."),
});

export const habitDecompositionSchema = z.object({
  goalSummary: z.string().min(8).max(240),
  selectedAnchor: z.string().min(2).max(120),
  microActions: z.array(microActionSchema).min(1).max(3),
  todayAction: microActionSchema,
  fallbackAction: z.string().min(3).refine(isConcreteAction, "Fallback action must be concrete and observable."),
  source: z.enum(["openai", "mock"]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type MicroAction = z.infer<typeof microActionSchema>;
export type HabitDecomposition = z.infer<typeof habitDecompositionSchema>;
