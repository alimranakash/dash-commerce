import { z } from "zod";
import { manualOrderItemSchema, optionalAmount } from "./order-create.schema";
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
 * Covers the customer, the address, the products and the money. The subtotal
 * is absent because it is not the seller's to state: it is the sum of the lines
 * below, priced against the catalog, and an order that could disagree with its
 * own items would be worse than one that cannot be corrected.
 *
 * The customer and address fields mirror checkout.schema, and the lines mirror
 * the manual order form, so a corrected order validates exactly like a freshly
 * placed one.
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
  /**
   * Absent means "leave the products alone", which is how an order that is
   * already with a courier still gets its address corrected. Present means
   * replace them wholesale — and an order cannot be emptied down to nothing.
   */
  items: z
    .array(manualOrderItemSchema)
    .min(1, "An order must have at least one product.")
    .max(100, "An order can hold at most 100 lines.")
    .optional(),
  shippingAmount: optionalAmount("Delivery charge"),
  paymentMethod: z.enum(paymentMethodTypes),
  paymentReference: optionalText(120),
  paymentNote: optionalText(500)
});

/** What the edit form posts, before the schema has had a look at it. */
export type UpdateOrderDetailsFormInput = z.input<typeof updateOrderDetailsSchema>;
/** What everything below the parse works with. */
export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;
