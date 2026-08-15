import { z } from "zod";

export const abandonedCartOutreachChannels = ["email", "manual", "whatsapp"] as const;

export const markAbandonedCartContactedSchema = z.object({
  cartId: z.string().trim().min(1, "Cart is required."),
  channel: z.enum(abandonedCartOutreachChannels).default("manual")
});

export const markAbandonedCartRecoveredSchema = z.object({
  cartId: z.string().trim().min(1, "Cart is required.")
});

/**
 * Contact details captured from a checkout attempt.
 *
 * Deliberately looser than `checkoutSchema`: this runs so a seller can still
 * reach a shopper whose checkout never completed, so a half-filled form is
 * worth keeping rather than rejecting.
 */
export const abandonedCartContactSchema = z.object({
  email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .transform((value) => value || undefined),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => value || undefined)
});

export type AbandonedCartContactInput = z.infer<typeof abandonedCartContactSchema>;
export type MarkAbandonedCartContactedInput = z.infer<typeof markAbandonedCartContactedSchema>;
export type MarkAbandonedCartRecoveredInput = z.infer<typeof markAbandonedCartRecoveredSchema>;
