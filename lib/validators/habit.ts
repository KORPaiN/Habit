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

const anchorTextSchema = z.string().min(2, "앵커를 입력해 주세요.").max(120);
const shortTextSchema = z.string().trim().min(1);

export const onboardingBaseSchema = z.object({
  goal: z.string().min(3, "목표를 적어 주세요."),
  desiredOutcome: z.string().max(200).optional(),
  motivationNote: z.string().max(200).optional(),
  availableMinutes: z.coerce.number().min(1).max(30),
  difficulty: z.enum(["gentle", "steady", "hard"]),
  preferredTime: z.enum(["morning", "afternoon", "evening"]),
});

export const behaviorSwarmCandidateSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().min(3).max(140).refine(isConcreteAction, "행동은 구체적이어야 합니다."),
  details: z.string().max(240).optional().default(""),
  durationMinutes: z.number().min(1).max(5),
  desireScore: z.number().int().min(1).max(5),
  abilityScore: z.number().int().min(1).max(5),
  impactScore: z.number().int().min(1).max(5),
});

export const behaviorSwarmSchema = z
  .array(behaviorSwarmCandidateSchema)
  .min(6, "후보는 6개 이상이어야 합니다.")
  .max(10, "후보는 10개 이하여야 합니다.")
  .superRefine((candidates, ctx) => {
    const titles = new Set<string>();

    candidates.forEach((candidate, index) => {
      const normalized = candidate.title.trim().toLowerCase();

      if (titles.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "중복된 후보가 있습니다.",
          path: [index, "title"],
        });
      }

      titles.add(normalized);
    });
  });

export const habitGenerationInputSchema = onboardingBaseSchema.extend({
  anchor: anchorTextSchema,
});

export const onboardingSchema = habitGenerationInputSchema.extend({
  desiredOutcome: z.string().min(2, "원하는 변화를 적어 주세요.").max(200),
  motivationNote: z.string().max(200).optional().default(""),
  backupAnchors: z
    .array(anchorTextSchema)
    .max(2, "백업 앵커는 최대 2개까지 가능합니다.")
    .default([])
    .superRefine((anchors, ctx) => {
      const seen = new Set<string>();

      anchors.forEach((anchor, index) => {
        const normalized = anchor.trim().toLowerCase();

        if (seen.has(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "백업 앵커가 중복되었습니다.",
            path: [index],
          });
        }

        seen.add(normalized);
      });
    }),
  selectedBehavior: behaviorSwarmCandidateSchema,
  swarmCandidates: behaviorSwarmSchema,
  recipeText: z.string().min(6).max(220),
  celebrationText: z.string().min(1).max(120),
  rehearsalCount: z.coerce.number().int().min(0).max(7),
  mode: z.enum(["create", "reselect"]).default("create"),
});

export const savedAnchorSchema = z.object({
  cue: anchorTextSchema,
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
export const recipeTextSchema = z.string().min(6).max(220);

export type OnboardingInput = z.infer<typeof habitGenerationInputSchema>;
export type OnboardingWizardInput = z.infer<typeof onboardingSchema>;
export type OnboardingBaseInput = z.infer<typeof onboardingBaseSchema>;
export type SavedAnchorInput = z.infer<typeof savedAnchorSchema>;
export type MicroAction = z.infer<typeof microActionSchema>;
export type HabitDecomposition = z.infer<typeof habitDecompositionSchema>;
export type BehaviorSwarmCandidate = z.infer<typeof behaviorSwarmCandidateSchema>;
