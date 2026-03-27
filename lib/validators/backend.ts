import { z } from "zod";

export const difficultyLevelSchema = z.enum(["gentle", "steady", "hard"]);
export const preferredTimeSchema = z.enum(["morning", "afternoon", "evening"]);
export const planSourceSchema = z.enum(["ai", "manual", "recovery", "seed"]);
export const failureReasonSchema = z.enum([
  "too_big",
  "too_tired",
  "forgot",
  "schedule_conflict",
  "low_motivation",
  "other",
]);

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date.");

export const planMicroActionInputSchema = z.object({
  position: z.coerce.number().int().min(1).max(3),
  title: z.string().min(1).max(140),
  details: z.string().max(500).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(1).max(5),
  fallbackTitle: z.string().min(1).max(140),
  fallbackDetails: z.string().max(500).optional().nullable(),
  fallbackDurationMinutes: z.coerce.number().int().min(1).max(5),
});

export const planMicroActionsSchema = z
  .array(planMicroActionInputSchema)
  .min(1)
  .max(3)
  .superRefine((actions, ctx) => {
    const positions = new Set<number>();

    actions.forEach((action, index) => {
      if (positions.has(action.position)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each micro-action position must be unique.",
          path: [index, "position"],
        });
      }

      positions.add(action.position);
    });
  });

export const onboardingRequestSchema = z.object({
  userId: uuidSchema.optional(),
  goalTitle: z.string().min(3).max(120),
  goalWhy: z.string().max(300).optional().nullable(),
  difficulty: difficultyLevelSchema,
  availableMinutes: z.coerce.number().int().min(1).max(30),
  anchorLabel: z.string().min(2).max(80),
  anchorCue: z.string().min(2).max(160),
  preferredTime: preferredTimeSchema,
  microActions: planMicroActionsSchema.optional(),
});

export const createPlanRequestSchema = z.object({
  userId: uuidSchema.optional(),
  goalId: uuidSchema,
  source: planSourceSchema.default("manual"),
  basedOnPlanId: uuidSchema.optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  microActions: planMicroActionsSchema,
});

export const assignDailyActionRequestSchema = z.object({
  userId: uuidSchema.optional(),
  goalId: uuidSchema,
  planId: uuidSchema,
  microActionId: uuidSchema,
  actionDate: isoDateSchema.optional(),
});

export const completeDailyActionRequestSchema = z.object({
  usedFallback: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export const failDailyActionRequestSchema = z.object({
  failureReason: failureReasonSchema,
  notes: z.string().max(500).optional().nullable(),
  createRecoveryPlan: z.boolean().default(true),
});

export const weeklyReviewRequestSchema = z.object({
  userId: uuidSchema.optional(),
  goalId: uuidSchema,
  weekStart: isoDateSchema,
  completedDays: z.coerce.number().int().min(0).max(7),
  skippedDays: z.coerce.number().int().min(0).max(7),
  failedDays: z.coerce.number().int().min(0).max(7),
  bestStreak: z.coerce.number().int().min(0).max(7),
  difficultMoments: z.string().min(3).max(500),
  helpfulPattern: z.string().min(3).max(500),
  nextAdjustment: z.string().min(3).max(500),
  summary: z.string().max(1000).optional().nullable(),
});

export const weeklyReviewQuerySchema = z.object({
  userId: uuidSchema.optional(),
  goalId: uuidSchema,
  weekStart: isoDateSchema,
});

export type PlanMicroActionInput = z.infer<typeof planMicroActionInputSchema>;
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;
export type AssignDailyActionRequest = z.infer<typeof assignDailyActionRequestSchema>;
export type CompleteDailyActionRequest = z.infer<typeof completeDailyActionRequestSchema>;
export type FailDailyActionRequest = z.infer<typeof failDailyActionRequestSchema>;
export type WeeklyReviewRequest = z.infer<typeof weeklyReviewRequestSchema>;
