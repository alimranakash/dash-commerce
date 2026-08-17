import { z } from "zod";

/**
 * Billing period length in days. Admin-assigned periods are fixed-length rather
 * than calendar months, so the end date is predictable from the chosen start
 * date. Lives here because both the server repository and the admin UI need it.
 */
export const BILLING_CYCLE_DAYS: Record<"MONTHLY" | "YEARLY", number> = {
  MONTHLY: 30,
  YEARLY: 365
};

export const changeSubscriptionPlanSchema = z.object({
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  planId: z.string().trim().min(1, "Plan is required."),
  /** Period start. Omitted means "start now". */
  startsAt: z.coerce.date({ message: "Enter a valid start date." }).optional()
});

export const extendTrialSchema = z.object({
  days: z.coerce.number().int().min(1, "Trial extension must be at least 1 day.").max(365, "Trial extension cannot exceed 365 days.")
});

export type ChangeSubscriptionPlanInput = z.infer<typeof changeSubscriptionPlanSchema>;
export type ExtendTrialInput = z.infer<typeof extendTrialSchema>;
