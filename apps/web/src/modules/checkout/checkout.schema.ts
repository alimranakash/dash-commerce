import { z } from "zod";
import { parseCartScope } from "../cart/cart.types";
import { paymentMethodTypes } from "../payments/payment.schema";

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Phone number is required.")
    .max(30)
    .regex(/^[+\d][\d\s-]+$/, "Use a valid phone number."),
  email: z
    .union([z.email("Use a valid email address."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : undefined)),
  country: z.string().trim().min(2).max(80).default("Bangladesh"),
  district: z.string().trim().min(2, "District is required.").max(100),
  city: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  area: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  addressLine1: z.string().trim().min(8, "Full address is required.").max(320),
  addressLine2: z
    .string()
    .trim()
    .max(320)
    .optional()
    .transform((value) => value || undefined),
  postalCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => value || undefined),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  shippingRateId: z.string().trim().min(1, "Choose a shipping method."),
  paymentMethod: z.enum(paymentMethodTypes),
  paymentReference: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  paymentNote: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
  // Only read when the store verifies numbers on cash-on-delivery. Absent
  // everywhere else, which is why it cannot be required here.
  verificationCode: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((value) => value || undefined),
  // Only the code travels with the form. The discount it is worth is worked out
  // again on the server against the server's own cart — a posted amount would
  // be a price the shopper chose.
  couponCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || undefined),
  // Which product the shopper ticked the add-on box for, and nothing else
  // about it. The headline, the discount and the price are all read again on
  // the server from the store's own configuration — a posted price would be a
  // price the shopper chose.
  orderBumpProductId: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => value || undefined),
  // Generated once per checkout page load, so the same submission arriving
  // twice can be told apart from a shopper deliberately ordering twice.
  // Optional: a form rendered before this shipped, or one submitted with the
  // key stripped, still checks out — it just loses the protection.
  submissionId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => value || undefined),
  // Which of the shopper's two baskets this form is settling — their cart, or
  // the one-line basket a Direct Checkout opened. It names a cookie, never a
  // product and never a price: both baskets are the server's own, signed, and
  // re-priced from the catalogue at order time, so the worst an invented value
  // can do is check out the ordinary cart.
  //
  // Narrowed rather than rejected, and absent everywhere the ordinary cart is
  // meant — the AI Shopping Agent posts no scope at all and gets the cart it
  // has been filling.
  checkoutScope: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform((value) => (value ? parseCartScope(value) : undefined))
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
