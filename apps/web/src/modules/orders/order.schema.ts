import { z } from "zod";
import { optionalAmount } from "./order-create.schema";
import { paymentMethodTypes } from "../payments/payment.schema";

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
 * Covers the customer, the address, and the money that is not tied to stock —
 * a negotiated delivery charge, a discount agreed on the phone, a customer who
 * switched from cash to bKash. The subtotal is not here because it is the sum
 * of the order's lines, and changing those means moving stock, which is a
 * different feature with different invariants (see the edit page copy).
 *
 * The customer and address fields mirror checkout.schema so a corrected order
 * validates exactly like a freshly placed one.
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
  notes: optionalText(1000),
  /** Blank keeps whatever the order already carries; see `optionalAmount`. */
  discountAmount: optionalAmount("Discount"),
  shippingAmount: optionalAmount("Delivery charge"),
  paymentMethod: z.enum(paymentMethodTypes),
  paymentReference: optionalText(120),
  paymentNote: optionalText(500)
});

export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;
