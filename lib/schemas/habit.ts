import { z } from "zod";

export const onboardingSchema = z.object({
  goal: z.string().min(3, "Please enter a goal you care about."),
  availableMinutes: z.coerce.number().min(1).max(30),
  difficulty: z.enum(["gentle", "steady", "hard"]),
  preferredTime: z.enum(["morning", "afternoon", "evening"]),
  anchor: z.enum(["after-coffee", "after-shower", "before-work", "before-bed"]),
});

export const microActionSchema = z.object({
  title: z.string(),
  reason: z.string(),
  durationMinutes: z.number().min(1).max(5),
  fallbackAction: z.string(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type MicroAction = z.infer<typeof microActionSchema>;
