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

export const DEFAULT_DIFFICULTY = "gentle" as const;
export const DEFAULT_AVAILABLE_MINUTES = 5;
export const DEFAULT_PREFERRED_TIME = "morning" as const;

function isConcreteAction(value: string) {
  return !vagueActionPatterns.some((pattern) => pattern.test(value));
}

export function hasMeaningfulText(value: string) {
  const letters = Array.from(value.trim()).filter((char) => {
    const code = char.codePointAt(0) ?? 0;

    return (
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 0xac00 && code <= 0xd7a3)
    );
  });

  return letters.length >= 2;
}

const meaningfulGoalSchema = z
  .string()
  .trim()
  .min(3, "시작할 목표를 적어주세요.")
  .max(120)
  .refine(hasMeaningfulText, "숫자만 말고 짧은 문장으로 적어주세요.");

const meaningfulOutcomeSchema = z
  .string()
  .trim()
  .min(2, "원하는 변화를 적어주세요.")
  .max(200)
  .refine(hasMeaningfulText, "숫자만 말고 짧은 문장으로 적어주세요.");

const habitTextSchema = z
  .string()
  .trim()
  .min(2, "붙일 루틴을 적어주세요.")
  .max(120)
  .refine(hasMeaningfulText, "숫자만 말고 익숙한 루틴을 적어주세요.");

const shortTextSchema = z.string().trim().min(1);

export const onboardingBaseSchema = z.object({
  goal: meaningfulGoalSchema,
  desiredOutcome: meaningfulOutcomeSchema.optional(),
  difficulty: z.enum(["gentle", "steady", "hard"]).default(DEFAULT_DIFFICULTY),
  availableMinutes: z.coerce.number().min(1).max(30).default(DEFAULT_AVAILABLE_MINUTES),
  preferredTime: z.enum(["morning", "afternoon", "evening"]).default(DEFAULT_PREFERRED_TIME),
});

export const behaviorSwarmCandidateSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().trim().min(3).max(140).refine(isConcreteAction, "행동은 구체적이어야 해요."),
  details: z.string().trim().max(240).optional().default(""),
  durationMinutes: z.number().min(1).max(5),
  desireScore: z.number().int().min(1).max(5),
  abilityScore: z.number().int().min(1).max(5),
  impactScore: z.number().int().min(1).max(5),
});

export const behaviorSwarmSchema = z
  .array(behaviorSwarmCandidateSchema)
  .min(6, "후보는 6개 이상 필요해요.")
  .max(10, "후보는 10개까지만 보여줄게요.")
  .superRefine((candidates, ctx) => {
    const titles = new Set<string>();

    candidates.forEach((candidate, index) => {
      const normalized = candidate.title.trim().toLowerCase();

      if (titles.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "같은 후보가 들어 있어요.",
          path: [index, "title"],
        });
      }

      titles.add(normalized);
    });
  });

export const habitGenerationInputSchema = onboardingBaseSchema.extend({
  anchor: habitTextSchema,
});

export const onboardingSchema = habitGenerationInputSchema.extend({
  desiredOutcome: meaningfulOutcomeSchema,
  selectedBehavior: behaviorSwarmCandidateSchema,
  swarmCandidates: behaviorSwarmSchema,
  recipeText: z.string().trim().min(3).max(220),
  celebrationText: z.string().trim().min(1).max(120),
  mode: z.enum(["create", "reselect"]).default("create"),
});

export const savedAnchorSchema = z.object({
  cue: habitTextSchema,
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
  source: z.enum(["openai", "mock", "rules", "hybrid"]),
});

export const celebrationTextSchema = shortTextSchema.max(120);
export const recipeTextSchema = z.string().trim().min(3).max(220);

export type OnboardingInput = z.infer<typeof habitGenerationInputSchema>;
export type OnboardingWizardInput = z.infer<typeof onboardingSchema>;
export type OnboardingBaseInput = z.infer<typeof onboardingBaseSchema>;
export type SavedAnchorInput = z.infer<typeof savedAnchorSchema>;
export type MicroAction = z.infer<typeof microActionSchema>;
export type HabitDecomposition = z.infer<typeof habitDecompositionSchema>;
export type BehaviorSwarmCandidate = z.infer<typeof behaviorSwarmCandidateSchema>;
