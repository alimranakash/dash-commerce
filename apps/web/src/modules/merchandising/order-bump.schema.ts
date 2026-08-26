import { z } from "zod";

export const orderBumpDiscountTypeSchema = z.enum(["PERCENTAGE", "FIXED"]);

export type OrderBumpDiscountType = z.infer<typeof orderBumpDiscountTypeSchema>;

/**
 * The floor an offer price is never allowed below.
 *
 * A 100% bump or a flat discount larger than the product is a free item, and a
 * zero-price order line reads as a bug to everyone who sees it afterwards.
 */
export const MIN_ORDER_BUMP_PRICE = 1;

export const saveOrderBumpSchema = z.object({
  description: z
    .union([z.string().trim().max(240), z.null(), z.undefined()])
    .transform((value) => value ?? ""),
  discountType: orderBumpDiscountTypeSchema.default("PERCENTAGE"),
  discountValue: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim() || "0")
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
      message: "Use a valid amount with up to 2 decimal places."
    }),
  enabled: z.coerce.boolean().default(false),
  headline: z.string().trim().min(2, "Write a headline for the offer.").max(120),
  /** Empty means "let the cart choose", which is the interesting setting. */
  productId: z
    .union([z.string().trim(), z.null(), z.undefined()])
    .transform((value) => (value ? value : null))
});

export type SaveOrderBumpInput = z.input<typeof saveOrderBumpSchema>;

/** What the checkout renders, and what it charges. */
export type OrderBumpOffer = {
  description: string;
  headline: string;
  imageUrl: string | null;
  /** The product's own price, shown struck through beside the offer. */
  listPrice: string;
  offerPrice: string;
  productId: string;
  savingAmount: string;
  title: string;
};

/**
 * What the shopper pays for the bump, from the seller's discount and the
 * product's live price.
 *
 * Both the checkout page and the order that follows it call this, so the price
 * on screen and the price charged cannot come apart — and neither of them ever
 * reads a price posted by the browser.
 */
export function orderBumpOfferPrice(input: {
  discountType: OrderBumpDiscountType;
  discountValue: string;
  listPrice: string;
}) {
  const listPrice = Number(input.listPrice);
  const discountValue = Number(input.discountValue);

  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return null;
  }

  const discount =
    input.discountType === "PERCENTAGE"
      ? (listPrice * clampPercentage(discountValue)) / 100
      : Math.max(0, discountValue);
  const offerPrice = Math.max(MIN_ORDER_BUMP_PRICE, listPrice - discount);

  // Nothing to offer: the discount rounds away, or the floor has eaten it.
  if (offerPrice >= listPrice) {
    return null;
  }

  return {
    offerPrice: offerPrice.toFixed(2),
    savingAmount: (listPrice - offerPrice).toFixed(2)
  };
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}
