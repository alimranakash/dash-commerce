import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

/**
 * What a seller is allowed to correct on an order after it was placed.
 *
 * Deliberately excludes money and line items: a shopper mistyping their name or
 * address is the case this exists for, and re-pricing an order is a different
 * feature with different invariants. Mirrors checkout.schema so a corrected
 * order validates exactly like a freshly placed one.
 */
export const updateOrderDetailsSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required.").max(120),
  customerPhone: z
    .string()
    .trim()
    .min(8, "Phone number is required.")
    .max(30)
    .regex(/^[+\d][\d\s-]+$/, "Use a valid phone number."),
  customerEmail: z
    .union([z.email("Use a valid email address."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : undefined)),
  addressLine1: z.string().trim().min(8, "Full address is required.").max(320),
  addressLine2: optionalText(320),
  area: optionalText(100),
  city: optionalText(100),
  district: z.string().trim().min(2, "District is required.").max(100),
  country: z.string().trim().min(2).max(80).default("Bangladesh"),
  postalCode: optionalText(20),
  notes: optionalText(1000)
});

export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;
