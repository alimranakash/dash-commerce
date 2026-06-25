import { z } from "zod";

export const changeSubscriptionPlanSchema = z.object({
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  planId: z.string().trim().min(1, "Plan is required.")
});

export const extendTrialSchema = z.object({
  days: z.coerce.number().int().min(1, "Trial extension must be at least 1 day.").max(365, "Trial extension cannot exceed 365 days.")
});

export type ChangeSubscriptionPlanInput = z.infer<typeof changeSubscriptionPlanSchema>;
export type ExtendTrialInput = z.infer<typeof extendTrialSchema>;
