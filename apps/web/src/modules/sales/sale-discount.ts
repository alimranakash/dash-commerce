/**
 * A sale's discount, typed at the counter either as money or as a percentage of
 * the subtotal. Only the money is ever stored — `Sale.discount` stays the amount
 * that came off — so the receipt, the sale page and the daily report read what
 * they always read. The percentage is worked out here, in whole cents and whole
 * basis points, and the form's live total and the server's saved one both call
 * this, so the two cannot disagree by a cent.
 */
export const SALE_DISCOUNT_TYPES = ["AMOUNT", "PERCENT"] as const;

export type SaleDiscountType = (typeof SALE_DISCOUNT_TYPES)[number];

/** 100%: the whole subtotal. A larger figure is a typo, refused rather than capped. */
export const SALE_DISCOUNT_MAX_PERCENT = 100;

/**
 * The cents a sale-level discount takes off `subtotalCents` — the lines after
 * their own discounts. An amount is capped at the subtotal, as it always was; a
 * percentage is rounded to the nearest cent, half up.
 */
export function saleDiscountCents(subtotalCents: number, value: string, type: SaleDiscountType) {
  const subtotal = Math.max(subtotalCents, 0);

  if (type === "PERCENT") {
    const basisPoints = Math.min(toHundredths(value), SALE_DISCOUNT_MAX_PERCENT * 100);

    return Math.round((subtotal * basisPoints) / 10_000);
  }

  return Math.min(toHundredths(value), subtotal);
}

/** "12.5" → 1250, for money (cents) and percentages (basis points) alike; anything unusable is 0. */
function toHundredths(value: string) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
}
