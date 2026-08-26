import { z } from "zod";

export const bundleTypeSchema = z.enum(["SET", "QUANTITY"]);
export const bundleDiscountTypeSchema = z.enum(["PERCENTAGE", "FIXED"]);
export const bundleStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export type BundleType = z.infer<typeof bundleTypeSchema>;
export type BundleDiscountType = z.infer<typeof bundleDiscountTypeSchema>;
export type BundleStatus = z.infer<typeof bundleStatusSchema>;

/**
 * How many products one bundle may name.
 *
 * A deal a shopper cannot hold in their head is not a deal, and the cart has to
 * be able to explain in one line why it took money off.
 */
export const MAX_BUNDLE_ITEMS = 8;

const optionalDateSchema = z
  .union([z.string().trim(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  });

const bundleItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(50).default(1)
});

export const saveBundleSchema = z
  .object({
    buyQuantity: z.coerce.number().int().min(0).max(50).default(0),
    description: z
      .union([z.string().trim().max(160), z.null(), z.undefined()])
      .transform((value) => value ?? ""),
    discountType: bundleDiscountTypeSchema.default("PERCENTAGE"),
    discountValue: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim() || "0")
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
        message: "Use a valid amount with up to 2 decimal places."
      }),
    expiresAt: optionalDateSchema,
    getQuantity: z.coerce.number().int().min(0).max(50).default(0),
    items: z.array(bundleItemSchema).min(1, "Add at least one product.").max(MAX_BUNDLE_ITEMS),
    name: z.string().trim().min(2, "Give the bundle a name.").max(120),
    startsAt: optionalDateSchema,
    status: bundleStatusSchema.default("ACTIVE"),
    type: bundleTypeSchema.default("SET")
  })
  .superRefine((data, ctx) => {
    if (Number(data.discountValue) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Set a discount above zero.",
        path: ["discountValue"]
      });
    }

    if (data.discountType === "PERCENTAGE" && Number(data.discountValue) > 100) {
      ctx.addIssue({
        code: "custom",
        message: "A percentage cannot go above 100.",
        path: ["discountValue"]
      });
    }

    // A set of one product is a plain discount, and the cart already has a
    // simpler way to say that.
    if (data.type === "SET" && data.items.length < 2 && data.items[0]?.quantity === 1) {
      ctx.addIssue({
        code: "custom",
        message: "A set needs two products, or two of the same one.",
        path: ["items"]
      });
    }

    if (data.type === "QUANTITY" && (data.buyQuantity < 1 || data.getQuantity < 1)) {
      ctx.addIssue({
        code: "custom",
        message: "Say how many must be bought and how many are then discounted.",
        path: ["buyQuantity"]
      });
    }

    if (data.startsAt && data.expiresAt && data.expiresAt <= data.startsAt) {
      ctx.addIssue({
        code: "custom",
        message: "The end date has to come after the start date.",
        path: ["expiresAt"]
      });
    }
  });

export type SaveBundleInput = z.input<typeof saveBundleSchema>;

/**
 * The sentence the cart shows when a bundle applies, when the seller has not
 * written one.
 *
 * Derived rather than stored so it cannot drift from the rule it describes.
 */
export function describeBundle(bundle: {
  buyQuantity: number;
  discountType: BundleDiscountType;
  discountValue: string;
  getQuantity: number;
  itemCount: number;
  type: BundleType;
}) {
  const off =
    bundle.discountType === "PERCENTAGE"
      ? `${trimZeros(bundle.discountValue)}% off`
      : `${trimZeros(bundle.discountValue)} off`;

  if (bundle.type === "QUANTITY") {
    const free = bundle.discountType === "PERCENTAGE" && Number(bundle.discountValue) >= 100;

    return `Buy ${bundle.buyQuantity}, get ${bundle.getQuantity} ${free ? "free" : off}`;
  }

  return `Buy ${bundle.itemCount === 1 ? "the set" : `all ${bundle.itemCount}`} together, ${off}`;
}

function trimZeros(value: string) {
  return String(Number(value));
}
