import { cache } from "react";
import { formatStorefrontMoney } from "../storefront/format";
import {
  getFreeShippingRecord,
  hasFreeShippingProduct,
  upsertFreeShippingRecord,
  type FreeShippingRecord
} from "./free-shipping.repository";
import {
  formatFreeShippingMessage,
  freeShippingProgress,
  type FreeShippingRule
} from "./free-shipping.render";
import {
  FREE_SHIPPING_DEFAULTS,
  FREE_SHIPPING_SURFACES,
  freeShippingSettingsSchema,
  toFreeShippingRule,
  type FreeShippingBarView,
  type FreeShippingSettings,
  type FreeShippingSettingsInput,
  type FreeShippingSurface
} from "./free-shipping.schema";

/**
 * Free shipping: the stored rule, and the bar that announces it.
 *
 * `getFreeShippingRule` is the important export. Checkout calls it to decide
 * what to charge and the storefront calls it to decide what to promise, so the
 * two cannot disagree — which they did before this module existed, because the
 * bar read a theme setting and checkout read nothing at all.
 *
 * Both reads are wrapped in React's `cache()`: a cart page renders the bar and
 * the totals, a checkout renders the quote and then creates the order, and none
 * of that should cost more than one row.
 */

export const getFreeShippingSettings = cache(async function getFreeShippingSettings(
  storeId: string
): Promise<FreeShippingSettings> {
  const record = await getFreeShippingRecord(storeId);

  return record ? fromRecord(record) : { ...FREE_SHIPPING_DEFAULTS };
});

/**
 * The rule half, for checkout and for the pure functions.
 *
 * Separate from the settings read so the call site that decides money does not
 * also carry the seller's marketing copy around with it.
 */
export const getFreeShippingRule = cache(async function getFreeShippingRule(
  storeId: string
): Promise<FreeShippingRule> {
  return toFreeShippingRule(await getFreeShippingSettings(storeId));
});

/**
 * Whether anything in this basket earns free delivery on its own.
 *
 * Cached per request like the rule, because a cart page asks it for the bar and
 * a checkout asks it for the quote and then again for the order — one question,
 * three call sites, one query.
 *
 * The ids are joined into the cache key rather than passed as an array, since
 * `cache()` compares arguments by identity and a fresh array on every call would
 * memoise nothing.
 */
const readCartEarnsFreeShipping = cache(async function readCartEarnsFreeShipping(
  storeId: string,
  productIdKey: string
): Promise<boolean> {
  return hasFreeShippingProduct(storeId, productIdKey === "" ? [] : productIdKey.split(","));
});

export function cartEarnsFreeShipping(storeId: string, productIds: string[]) {
  return readCartEarnsFreeShipping(storeId, [...new Set(productIds)].sort().join(","));
}

export async function saveFreeShippingSettings(
  storeId: string,
  input: FreeShippingSettingsInput
): Promise<FreeShippingSettings> {
  const parsed = freeShippingSettingsSchema.parse(input);

  await upsertFreeShippingRecord(storeId, {
    ...parsed,
    // The columns are TEXT; the settings are a number and two lists. Converted
    // in the one place that knows both shapes, so neither the repository nor the
    // form has to.
    surfaces: parsed.surfaces.join(","),
    threshold: parsed.threshold.toFixed(2),
    zoneIds: parsed.zoneIds.join(",")
  });

  return parsed;
}

/**
 * The bar this cart should show on this surface, or null.
 *
 * Null covers every reason there is nothing to say: the seller has not switched
 * free shipping on, the bar is switched off, this surface was not chosen, or
 * there is no threshold. The caller renders nothing at all — an empty progress
 * track implies an offer, and implying one the checkout will not honour is the
 * failure this whole module was written to remove.
 */
export async function getFreeShippingBar(input: {
  currency: string;
  /** Whether anything already in the cart earns it outright. */
  hasFreeShippingProduct?: boolean | undefined;
  storeId: string;
  subtotal: number | string;
  surface: FreeShippingSurface;
}): Promise<FreeShippingBarView | null> {
  const settings = await getFreeShippingSettings(input.storeId);

  if (!settings.barEnabled || !settings.surfaces.includes(input.surface)) {
    return null;
  }

  const progress = freeShippingProgress(toFreeShippingRule(settings), input.subtotal, {
    hasFreeShippingProduct: input.hasFreeShippingProduct
  });

  if (!progress) {
    return null;
  }

  return {
    message: progress.qualifies
      ? formatFreeShippingMessage(
          settings.barSuccessText,
          formatStorefrontMoney(progress.threshold, input.currency)
        )
      : formatFreeShippingMessage(
          settings.barText,
          formatStorefrontMoney(progress.remaining, input.currency)
        ),
    percent: progress.percent,
    qualifies: progress.qualifies
  };
}

/**
 * A stored row, narrowed back to the settings shape.
 *
 * Everything is TEXT in the database, so a value written by a newer deploy or by
 * hand is replaced with a safe default here rather than reaching checkout. The
 * safe default for the threshold is `0`, which `isFreeShippingLive` reads as
 * "no offer" — an unreadable number must never become free delivery.
 */
function fromRecord(record: FreeShippingRecord): FreeShippingSettings {
  const threshold = Number(record.threshold);

  return {
    barEnabled: record.barEnabled,
    barSuccessText: String(record.barSuccessText ?? ""),
    barText: String(record.barText ?? ""),
    enabled: record.enabled,
    surfaces: parseSurfaces(record.surfaces),
    threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 0,
    zoneIds: parseList(record.zoneIds)
  };
}

function parseSurfaces(value: string): FreeShippingSurface[] {
  const parsed = parseList(value).filter((entry): entry is FreeShippingSurface =>
    (FREE_SHIPPING_SURFACES as readonly string[]).includes(entry)
  );

  return [...new Set(parsed)];
}

function parseList(value: string) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
