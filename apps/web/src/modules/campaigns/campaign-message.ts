/**
 * Placeholder substitution for campaign bodies.
 *
 * Deliberately tiny and deliberately not a template engine: this text goes out
 * over SMS to thousands of people at a seller's expense, so the set of things
 * it can say has to be enumerable by reading one file.
 */

export const CAMPAIGN_PLACEHOLDERS = ["coupon_code", "name", "store_name"] as const;

export type CampaignPlaceholder = (typeof CAMPAIGN_PLACEHOLDERS)[number];

export type CampaignRenderContext = {
  couponCode?: string | null;
  name?: string | null;
  storeName: string;
};

const PLACEHOLDER_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

/**
 * Fills in the placeholders a body uses.
 *
 * An unknown placeholder is left exactly as written rather than blanked. A
 * message reading "20% off {{discount}}" is obviously broken to whoever reads
 * it; the same message with a silent hole in it looks fine and is not.
 */
export function renderCampaignBody(body: string, context: CampaignRenderContext) {
  return body.replace(PLACEHOLDER_PATTERN, (match, rawKey: string) => {
    switch (rawKey) {
      case "coupon_code":
        return context.couponCode ?? match;
      case "name":
        // Falls back rather than leaving "Hi ," — a campaign should not look
        // broken because one customer was saved without a name.
        return context.name?.trim() || "there";
      case "store_name":
        return context.storeName;
      default:
        return match;
    }
  });
}

/** Which known placeholders a body actually uses. */
export function findCampaignPlaceholders(body: string): CampaignPlaceholder[] {
  const found = new Set<CampaignPlaceholder>();

  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1];

    if (key && (CAMPAIGN_PLACEHOLDERS as readonly string[]).includes(key)) {
      found.add(key as CampaignPlaceholder);
    }
  }

  return [...found];
}

/**
 * Placeholders the body uses that nothing will be able to fill.
 *
 * Checked before a send starts, not during it: "{{coupon_code}}" going out
 * literally to four thousand phones is not a mistake worth discovering from the
 * delivery log.
 */
export function findUnfillablePlaceholders(body: string, context: { hasCoupon: boolean }) {
  return findCampaignPlaceholders(body).filter(
    (placeholder) => placeholder === "coupon_code" && !context.hasCoupon
  );
}
