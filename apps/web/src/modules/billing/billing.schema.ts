import { z } from "zod";

export const billingCycles = ["MONTHLY", "YEARLY"] as const;
export const manualPaymentMethods = ["BKASH", "NAGAD", "ROCKET", "BANK"] as const;

export const submitManualPaymentSchema = z.object({
  billingCycle: z.enum(billingCycles),
  paymentMethod: z.enum(manualPaymentMethods),
  paymentNote: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
  paymentReference: z.string().trim().min(3, "Transaction ID is required.").max(120),
  planId: z.string().trim().min(1, "Choose a plan."),
  senderNumber: z.string().trim().min(5, "Sender number is required.").max(40)
});

export const billingSettingsSchema = z.object({
  bankAccountDetails: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  bkashAccountType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  bkashNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || undefined),
  nagadAccountType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  nagadNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || undefined),
  paymentInstructions: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  rocketAccountType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  rocketNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || undefined)
});

export type BillingSettingsInput = z.infer<typeof billingSettingsSchema>;
export type SubmitManualPaymentInput = z.infer<typeof submitManualPaymentSchema>;
