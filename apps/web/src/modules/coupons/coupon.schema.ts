import { z } from "zod";

export const couponDiscountTypeSchema = z.enum(["PERCENTAGE", "FIXED_CART", "FREE_SHIPPING"]);
export const couponStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

/**
 * Codes are compared upper-cased everywhere — at checkout a shopper types
 * whatever case they like, and `@@unique([storeId, code])` only behaves as
 * sellers expect if every write normalises first.
 */
export function normaliseCouponCode(value: string) {
  return value.trim().toUpperCase();
}

const couponCodeSchema = z
  .string()
  .transform(normaliseCouponCode)
  .pipe(
    z
      .string()
      .min(3, "Coupon codes are at least 3 characters.")
      .max(40, "Coupon codes are at most 40 characters.")
      .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Use letters, digits, dashes and underscores only.")
  );

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => (value === null || value === undefined ? "" : String(value).trim()))
  .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  })
  .transform((value) => (value === "" ? undefined : value));

const optionalPositiveIntSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => (value === null || value === undefined ? "" : String(value).trim()))
  .refine((value) => value === "" || /^\d{1,9}$/.test(value), {
    message: "Use a whole number."
  })
  .transform((value) => (value === "" ? undefined : Number(value)))
  .refine((value) => value === undefined || value >= 1, {
    message: "A usage limit has to be at least 1."
  });

/**
 * Dates arrive from `<input type="date">` as `YYYY-MM-DD`, i.e. midnight in
 * nobody's timezone in particular. `startsAt` is taken as the start of that day
 * and `expiresAt` as the *end* of it, which is what a seller means by "valid
 * until the 30th" — the alternative silently kills the coupon a day early.
 */
const optionalDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value === null || value === undefined ? "" : value.trim()))
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use a valid date."
  })
  .transform((value) => (value === "" ? undefined : value));

/**
 * Every genuinely optional key carries a trailing `.optional()`.
 *
 * Not decoration: a transform-wrapped union that *accepts* `undefined` still
 * requires the key to be **present** in Zod 4, so without this a caller that
 * simply omits `minSubtotal` gets a validation error rather than a coupon with
 * no minimum. The form action always sends every key, so only non-form callers
 * would ever have hit it.
 */
const couponBaseSchema = z.object({
  code: couponCodeSchema,
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().max(500).optional())
    .optional(),
  discountType: couponDiscountTypeSchema.default("PERCENTAGE"),
  discountValue: moneySchema,
  expiresAt: optionalDateSchema.optional(),
  maxDiscountAmount: optionalMoneySchema.optional(),
  maxSubtotal: optionalMoneySchema.optional(),
  minSubtotal: optionalMoneySchema.optional(),
  name: z.string().trim().min(2, "Coupon name is required.").max(140),
  startsAt: optionalDateSchema.optional(),
  status: couponStatusSchema.default("ACTIVE"),
  usageLimitPerCustomer: optionalPositiveIntSchema.optional(),
  usageLimitTotal: optionalPositiveIntSchema.optional()
});

/**
 * Cross-field rules the individual fields cannot see.
 *
 * These run on create and update alike, which is why the refinement lives on a
 * shared base rather than on either schema: a coupon edited into an impossible
 * state is exactly as broken as one created that way.
 */
const withCouponInvariants = <T extends typeof couponBaseSchema>(schema: T) =>
  schema.superRefine((value, ctx) => {
    if (value.discountType === "PERCENTAGE") {
      const percent = Number(value.discountValue);

      if (percent <= 0 || percent > 100) {
        ctx.addIssue({
          code: "custom",
          message: "A percentage discount is between 0 and 100.",
          path: ["discountValue"]
        });
      }
    }

    if (value.discountType === "FIXED_CART" && Number(value.discountValue) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "A fixed discount has to be more than zero.",
        path: ["discountValue"]
      });
    }

    // Only percentages can run away with the cart, so a cap on anything else is
    // a seller misunderstanding the field rather than a value worth storing.
    if (value.maxDiscountAmount !== undefined && value.discountType !== "PERCENTAGE") {
      ctx.addIssue({
        code: "custom",
        message: "A maximum discount only applies to percentage coupons.",
        path: ["maxDiscountAmount"]
      });
    }

    if (
      value.minSubtotal !== undefined &&
      value.maxSubtotal !== undefined &&
      Number(value.maxSubtotal) < Number(value.minSubtotal)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Maximum spend cannot be below minimum spend.",
        path: ["maxSubtotal"]
      });
    }

    if (value.startsAt !== undefined && value.expiresAt !== undefined && value.expiresAt < value.startsAt) {
      ctx.addIssue({
        code: "custom",
        message: "The end date cannot be before the start date.",
        path: ["expiresAt"]
      });
    }
  });

export const createCouponSchema = withCouponInvariants(couponBaseSchema);
export const updateCouponSchema = withCouponInvariants(couponBaseSchema);

export type CouponDiscountType = z.infer<typeof couponDiscountTypeSchema>;
export type CouponStatus = z.infer<typeof couponStatusSchema>;
/** Raw form values, before the schema trims/normalises/validates them. */
export type CouponFormInput = z.input<typeof createCouponSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
