import { z } from "zod";
import { paymentMethodTypes } from "../payments/payment.schema";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

/**
 * A money field the seller may leave blank.
 *
 * `z.coerce.number()` would read an empty input as 0, which is a real amount and
 * not the same answer as "I did not type one" — a blank delivery charge has to
 * fall back to the shipping rate, not silently zero it. So the raw value is
 * normalised to a string first and only then checked.
 */
export const optionalAmount = (label: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .refine(
      (value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 99999999),
      `${label} must be a positive amount.`
    )
    .transform((value) => (value === "" ? undefined : Number(value).toFixed(2)));

export const manualOrderItemSchema = z.object({
  /** Blank means "charge what the product costs today". */
  price: optionalAmount("Unit price"),
  productId: z.string().trim().min(1, "Choose a product for every line."),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(9999, "Quantity is too large."),
  variantId: optionalText(200)
});

/**
 * An order the seller types in themselves — the phone call, the Facebook
 * message, the walk-in — rather than one a shopper placed at checkout.
 *
 * Customer and address fields mirror checkout.schema so a manual order validates
 * exactly like a placed one and the courier layer cannot tell them apart. What
 * checkout does *not* have is the money: the seller picks the lines, may
 * override a unit price or the delivery charge, and may record the order as
 * already paid, because on this path the cash is often already in hand.
 */
export const createManualOrderSchema = z.object({
  addressLine1: z.string().trim().min(8, "Full address is required.").max(320),
  addressLine2: optionalText(320),
  area: optionalText(100),
  city: optionalText(100),
  country: z.string().trim().min(2).max(80).default("Bangladesh"),
  customerEmail: z
    .union([z.email("Use a valid email address."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : undefined)),
  customerName: z.string().trim().min(2, "Customer name is required.").max(120),
  customerPhone: z
    .string()
    .trim()
    .min(8, "Phone number is required.")
    .max(30)
    .regex(/^[+\d][\d\s-]+$/, "Use a valid phone number."),
  discountAmount: optionalAmount("Discount"),
  district: z.string().trim().min(2, "District is required.").max(100),
  items: z
    .array(manualOrderItemSchema)
    .min(1, "Add at least one product to the order.")
    .max(100, "An order can hold at most 100 lines."),
  notes: optionalText(1000),
  paymentMethod: z.enum(paymentMethodTypes),
  paymentNote: optionalText(500),
  paymentReference: optionalText(120),
  paymentStatus: z.enum(["PENDING", "PAID"]).default("PENDING"),
  postalCode: optionalText(20),
  /** Per-order opt-out. The store-wide SMS toggle still has the final say. */
  sendSms: z.boolean().default(false),
  shippingAmount: optionalAmount("Delivery charge"),
  shippingRateId: optionalText(200),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED"]).default("CONFIRMED")
});

export type CreateManualOrderInput = z.input<typeof createManualOrderSchema>;
export type ManualOrderItemInput = z.infer<typeof manualOrderItemSchema>;
