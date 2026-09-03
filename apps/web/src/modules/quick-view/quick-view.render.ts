import type { StorefrontAdvancedSettings } from "../storefront/customization";
import type { QuickViewProduct, QuickViewVariant, QuickViewView } from "./quick-view.types";

/**
 * Quick View's decisions, as pure functions.
 *
 * Everything a shopper is shown that is not simply a column — whether the
 * feature renders at all, how much of a description fits, what "30% off" is a
 * percentage of — is settled here rather than in the service, so
 * `npm run verify:quick-view` can drive all of it without a database and
 * without a request. The service's own job is reduced to reading rows.
 */

/**
 * The seller's Quick View, or null.
 *
 * Null when the switch is off, and the callers render **nothing at all** for it
 * — no hidden button, no empty provider. A trigger present in the markup but
 * hidden in CSS is a trigger a keyboard still reaches and a scraper still reads,
 * and "off" has to mean off.
 *
 * The buy-box fields are read straight off `productPage`. That is the whole
 * reason there is no `quickView.addToCartText`: a shop that renamed its button
 * to "Order Now" renamed it everywhere, and a second copy of the word is a
 * second thing to keep in step.
 */
export function buildQuickViewView(settings: StorefrontAdvancedSettings): QuickViewView | null {
  const quickView = settings.quickView;

  if (!quickView.enabled) {
    return null;
  }

  return {
    addToCartButtonColor: settings.productPage.addToCartButtonColor,
    addToCartButtonRadius: settings.productPage.addToCartButtonRadius,
    addToCartText: settings.productPage.addToCartText,
    buttonLabel: quickView.buttonLabel,
    descriptionEnabled: quickView.descriptionEnabled,
    directCheckoutEnabled: quickView.directCheckoutEnabled,
    directCheckoutText: settings.productPage.directCheckoutText,
    fullDetailsText: quickView.fullDetailsText,
    galleryEnabled: quickView.galleryEnabled,
    quantityEnabled: quickView.quantityEnabled,
    triggerStyle: quickView.triggerStyle,
    variantEnabled: quickView.variantEnabled,
    variantStyle: settings.productPage.variantStyle,
    wishlistEnabled: quickView.wishlistEnabled
  };
}

/**
 * A product description, cut to what a modal has room for.
 *
 * Three things happen here and each of them has bitten a storefront somewhere.
 *
 * Markup is **removed**, not rendered. Descriptions are seller-typed and some of
 * them carry HTML from a paste out of a supplier's site; the product page has a
 * container built for it, a modal caption does not, and text is never a script.
 * Entities are decoded afterwards so `&amp;` reads as an ampersand rather than
 * as five characters of noise.
 *
 * The cut lands on a **word boundary**. Truncating mid-word reads as a rendering
 * fault rather than as a summary, and the ellipsis is the thing that tells the
 * shopper there is more behind "View full details".
 *
 * And a description that already fits gets **no ellipsis**, because a promise of
 * more where there is no more is the small lie that makes the link feel broken.
 */
export function quickViewSummary(value: string | null | undefined, limit: number) {
  const plain = decodeEntities(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  const max = Math.max(1, Math.round(limit));

  if (plain.length <= max) {
    return plain;
  }

  const clipped = plain.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${(lastSpace > max * 0.5 ? clipped.slice(0, lastSpace) : clipped).replace(/[-\s,;:.]+$/, "")}…`;
}

/**
 * How much off, as a whole percent — or null when there is nothing to claim.
 *
 * Compared in whole cents for the reason the free-shipping bar gives: these are
 * decimal strings out of a `Decimal` column, and floating point is not something
 * to route a discount claim through. A compare-at price that is missing, equal,
 * lower or unreadable yields null rather than 0%, so the badge is absent instead
 * of announcing a saving of nothing.
 *
 * Rounded **down**, so a 49.6% cut is advertised as 49% off. A shop can only be
 * caught out by the rounding in one direction, and it is not this one.
 */
export function quickViewSavings(price: string | number, compareAtPrice: string | number | null | undefined) {
  if (compareAtPrice === null || compareAtPrice === undefined || compareAtPrice === "") {
    return null;
  }

  const priceCents = toCents(price);
  const compareCents = toCents(compareAtPrice);

  if (compareCents <= 0 || priceCents < 0 || compareCents <= priceCents) {
    return null;
  }

  const percent = Math.floor(((compareCents - priceCents) / compareCents) * 100);

  return percent > 0 ? percent : null;
}

/** Money as whole cents, so a percentage is not computed over binary floats. */
function toCents(value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;

  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/**
 * A catalogue row, as the modal reads it.
 *
 * Pure and total: it is handed rows and settings and returns the payload, which
 * is what lets the verify script assert the thing that actually matters here —
 * that a cost price, a supplier, a demo-pack id or an internal flag has no way
 * out of this function. Every field the browser receives is named below, so
 * adding one is a deliberate act rather than a widened `...product` spread.
 */
export function buildQuickViewProduct(input: {
  currency: string;
  descriptionLength: number;
  product: {
    allowPreorder: boolean;
    category?: { name: string } | null;
    compareAtPrice: { toString(): string } | null;
    description: string | null;
    id: string;
    images: Array<{ alt: string | null; url: string }>;
    preorderReleaseAt: Date | string | null;
    price: { toString(): string };
    shortDescription: string | null;
    sku: string | null;
    slug: string;
    stockQuantity: number;
    title: string;
  };
  storeId: string;
  variants: Array<{
    compareAtPrice?: string | null;
    continueSelling?: boolean;
    id: string;
    imageUrl?: string | null;
    optionSignature: string;
    price: string;
    sku?: string | null;
    status: "ACTIVE" | "INACTIVE";
    stockQuantity: number;
    title: string;
  }>;
}): QuickViewProduct {
  const { currency, descriptionLength, product, storeId, variants } = input;
  const price = product.price.toString();
  const compareAtPrice = product.compareAtPrice?.toString() ?? null;

  return {
    allowPreorder: product.allowPreorder,
    categoryName: product.category?.name ?? null,
    compareAtPrice,
    currency,
    // The short description is what a seller wrote *to be* a summary, so it
    // wins; the long one is cut only when there is no short one to use.
    description: quickViewSummary(
      product.shortDescription?.trim() || product.description,
      descriptionLength
    ),
    id: product.id,
    images: product.images.map((image) => ({ alt: image.alt, url: image.url })),
    preorderReleaseAt: toIso(product.preorderReleaseAt),
    price,
    savingsPercent: quickViewSavings(price, compareAtPrice),
    sku: product.sku,
    slug: product.slug,
    stockQuantity: product.stockQuantity,
    storeId,
    title: product.title,
    variants: activeQuickViewVariants(variants)
  };
}

/**
 * The options a shopper may actually pick.
 *
 * Inactive ones are dropped here rather than hidden in the component, so a
 * variant the seller switched off cannot be selected by a keyboard, posted by a
 * crafted form, or read out of the payload — the same call
 * `ProductVariantControls` makes on the product page.
 */
export function activeQuickViewVariants(
  variants: Array<{
    compareAtPrice?: string | null;
    continueSelling?: boolean;
    id: string;
    imageUrl?: string | null;
    optionSignature: string;
    price: string;
    sku?: string | null;
    status: "ACTIVE" | "INACTIVE";
    stockQuantity: number;
    title: string;
  }>
): QuickViewVariant[] {
  return variants
    .filter((variant) => variant.status !== "INACTIVE")
    .map((variant) => ({
      compareAtPrice: variant.compareAtPrice ?? null,
      continueSelling: Boolean(variant.continueSelling),
      id: variant.id,
      imageUrl: variant.imageUrl ?? null,
      optionSignature: variant.optionSignature,
      price: variant.price,
      sku: variant.sku ?? null,
      stockQuantity: variant.stockQuantity,
      title: variant.title
    }));
}

/**
 * What the shopper may put in the basket, as a number the stepper can cap at.
 *
 * A product sold past its stock has no ceiling worth quoting, so it gets a large
 * one rather than zero; the cart re-checks the real figure when the line is
 * written either way. This exists so the modal and the product page cap the same
 * way rather than each inventing a number.
 */
export function quickViewMaxQuantity(input: {
  allowPreorder: boolean;
  stockQuantity: number;
  variant?: { continueSelling: boolean; stockQuantity: number } | null | undefined;
}) {
  if (input.variant) {
    return input.variant.continueSelling ? UNCAPPED_QUANTITY : Math.max(0, input.variant.stockQuantity);
  }

  return input.allowPreorder ? UNCAPPED_QUANTITY : Math.max(0, input.stockQuantity);
}

const UNCAPPED_QUANTITY = 999999;

function toIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The handful of entities a stripped description actually carries.
 *
 * A full HTML decoder is not wanted here: this text is going into a React text
 * node, so nothing it produces is ever parsed as markup, and the job is only to
 * stop a pasted `&amp;` reading as five characters.
 */
function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}
