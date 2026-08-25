import { z } from "zod";

export const abandonedCartOutreachChannels = ["email", "manual", "whatsapp"] as const;

/** Keep in step with `IncompleteOrderFailureCode` in ./abandoned-cart.types. */
export const incompleteOrderFailureCodes = [
  "BLOCKED_IP",
  "COUPON",
  "EMPTY_CART",
  "ORDER_LIMIT",
  "OUT_OF_STOCK",
  "PAYMENT_REFERENCE",
  "PHONE_VERIFICATION",
  "STORE_LOCKED",
  "UNKNOWN",
  "VALIDATION"
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

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
  email: optionalText(320),
  name: optionalText(120),
  phone: optionalText(30)
});

/**
 * The rest of the checkout form, saved beside the contact details.
 *
 * Same contract as above and for the same reason — every field is optional, and
 * an address that would fail `checkoutSchema` is still the address the seller
 * needs in order to ring the shopper back. Nothing here is ever used to create
 * an order without a human retyping it into the manual order form.
 */
export const abandonedCartCheckoutDraftSchema = abandonedCartContactSchema.extend({
  addressLine1: optionalText(320),
  addressLine2: optionalText(320),
  area: optionalText(100),
  city: optionalText(100),
  country: optionalText(80),
  couponCode: optionalText(40),
  district: optionalText(100),
  paymentMethod: optionalText(40),
  postalCode: optionalText(20),
  shippingRateId: optionalText(200)
});

export const abandonedCartFailureSchema = z.object({
  code: z.enum(incompleteOrderFailureCodes).catch("UNKNOWN"),
  // The shopper's own error message. Capped rather than rejected: a stack-shaped
  // string is still the most useful thing a seller can be shown about it.
  reason: optionalText(500)
});

export type AbandonedCartCheckoutDraftInput = z.infer<typeof abandonedCartCheckoutDraftSchema>;
export type AbandonedCartFailureInput = z.infer<typeof abandonedCartFailureSchema>;
export type MarkAbandonedCartContactedInput = z.infer<typeof markAbandonedCartContactedSchema>;
export type MarkAbandonedCartRecoveredInput = z.infer<typeof markAbandonedCartRecoveredSchema>;
