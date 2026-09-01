import { getCart } from "../cart/cart.service";
import { isCheckoutPhoneOtpRequired } from "../checkout/checkout-verification.service";
import { getEnabledPaymentMethods, isManualPaymentType } from "../payments/payment.service";
import { getProductVariantConfiguration } from "../products/product-variants.service";
import { getEnabledShippingRates } from "../shipping/shipping.service";
import { preorderLabel } from "../storefront/format";
import {
  getStorefrontCategories,
  getStorefrontProducts,
  getStorefrontProductsByIds
} from "../storefront/resolver";
import type { StorefrontProduct } from "../storefront/storefront.types";
import type {
  ShoppingAgentCartView,
  ShoppingAgentComparison,
  ShoppingAgentProductCard,
  ShoppingAgentToolArgs
} from "./shopping-agent.schema";

/**
 * Where the shopping agent's facts come from.
 *
 * Every read below goes through `storefront/resolver.ts`, `cart.service.ts`,
 * `shipping.service.ts` or `payment.service.ts` — the same four modules that
 * render the shop's own pages. That is not tidiness, it is the safety property:
 * `getStorefrontProducts` applies `publicProductWhere`, so a DRAFT or HIDDEN
 * product cannot be recommended by the agent for the same reason it cannot be
 * linked from the category page, and a price the chat quotes is the price the
 * product page shows because both read the same row.
 *
 * The moment this file wrote a Prisma query of its own, the agent could sell
 * something the storefront does not.
 *
 * Two boundaries are worth stating because they are invisible in the types:
 *
 * - **Tenancy.** Every function takes `storeId` first and scopes on it. This
 *   file never sees a store selector from a caller — the service passes the id
 *   `getStorefrontBySlug` resolved from the hostname the shopper is on.
 * - **Cost price never leaves.** `toProductCard` is an explicit field list, so a
 *   column added to `Product` next month cannot reach a shopper by being picked
 *   up in a spread. `costPrice` is the one that matters, and it is not below.
 */

/** Storefront-relative product URL. The base path is added by the caller. */
function productHref(basePath: string, slug: string) {
  return `${basePath}/products/${slug}`;
}

/**
 * Everything a card needs, and nothing else.
 *
 * `requiresVariantChoice` is the field that keeps the agent honest about what it
 * can do: a product with options cannot be added to a cart from a chat bubble
 * without the shopper choosing a size or colour, so the card links to the
 * product page instead of offering a button that would add the wrong thing.
 */
export function toProductCard(
  product: StorefrontProduct,
  context: { basePath: string; hasVariants?: boolean }
): ShoppingAgentProductCard {
  const image = product.images[0];
  const inStock = product.stockQuantity > 0;

  return {
    available: inStock || product.allowPreorder,
    availabilityLabel: availabilityLabelFor(product),
    categoryName: product.category?.name ?? null,
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : null,
    href: productHref(context.basePath, product.slug),
    id: product.id,
    imageAlt: image?.alt ?? product.title,
    imageUrl: image?.url ?? null,
    price: product.price.toString(),
    requiresVariantChoice: Boolean(context.hasVariants),
    shortDescription: product.shortDescription?.trim() || null,
    title: product.title
  };
}

/**
 * The storefront's own vocabulary, not a second one.
 *
 * `StockStatus` renders these three states on every product card in the shop;
 * saying "available" in the chat where the card beside it says "Out of stock"
 * would be the agent contradicting the page it is sitting on.
 */
function availabilityLabelFor(product: {
  allowPreorder: boolean;
  preorderReleaseAt: Date | null;
  stockQuantity: number;
}) {
  if (product.stockQuantity <= 0) {
    return product.allowPreorder ? preorderLabel(product.preorderReleaseAt) : "Out of stock";
  }

  return `${product.stockQuantity} in stock`;
}

/**
 * The catalogue as the model reads it, one line per product.
 *
 * Compact on purpose: this text is spent out of the merchant's own API
 * allowance on every turn, and a full row per product would triple it for
 * fields no recommendation depends on.
 */
export async function searchCatalogue(
  storeId: string,
  args: ShoppingAgentToolArgs["search_products"],
  basePath: string
) {
  const products = await getStorefrontProducts(storeId, {
    ...(args.availability ? { availability: args.availability } : {}),
    ...(args.categorySlug ? { categorySlug: args.categorySlug } : {}),
    ...(args.maxPrice === undefined ? {} : { maxPrice: args.maxPrice }),
    ...(args.minPrice === undefined ? {} : { minPrice: args.minPrice }),
    ...(args.query ? { search: args.query } : {}),
    sort: args.sort,
    take: args.limit
  });

  return {
    matched: products.length,
    products: products.map((product) => toCatalogueLine(product, basePath))
  };
}

function toCatalogueLine(product: StorefrontProduct, basePath: string) {
  return {
    availability: availabilityLabelFor(product),
    category: product.category?.name ?? null,
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : null,
    id: product.id,
    price: product.price.toString(),
    summary: truncate(product.shortDescription ?? product.description, 220),
    title: product.title,
    url: productHref(basePath, product.slug)
  };
}

/**
 * One product in full, variants included.
 *
 * The variant rows are what let the agent answer "do you have it in medium" and
 * "is the black one cheaper" from the catalogue rather than from a guess — and
 * they carry the ids `add_to_cart` needs, so a shopper who names a size gets the
 * right line rather than the default one.
 */
export async function readProductDetails(storeId: string, productId: string, basePath: string) {
  const product = await findPublicProduct(storeId, productId);

  if (!product) {
    return null;
  }

  const configuration = await getProductVariantConfiguration(storeId, product.id);

  return {
    ...toCatalogueLine(product, basePath),
    description: truncate(product.description, 1200),
    images: product.images.length,
    options: configuration.attributes.map((attribute) => attribute.name),
    sku: product.sku,
    variants: configuration.variants
      .filter((variant) => variant.status === "ACTIVE")
      .slice(0, 20)
      .map((variant) => ({
        id: variant.id,
        inStock: variant.stockQuantity > 0 || variant.continueSelling,
        price: variant.price ?? product.price.toString(),
        stockQuantity: variant.stockQuantity,
        title: variant.title
      }))
  };
}

/**
 * Two to four products side by side.
 *
 * Built here rather than left to the model because a comparison is exactly where
 * a language model is most likely to be confidently wrong: it is a table of
 * numbers that all look alike. Every cell below is read from the catalogue row,
 * so the worst the model can do is choose an odd pair to compare.
 */
export async function compareProducts(
  storeId: string,
  productIds: string[],
  basePath: string
): Promise<ShoppingAgentComparison | null> {
  const products = await findPublicProducts(storeId, productIds);

  if (products.length < 2) {
    return null;
  }

  const configurations = await Promise.all(
    products.map((product) => getProductVariantConfiguration(storeId, product.id))
  );

  return {
    products: products.map((product) => ({ id: product.id, title: product.title })),
    rows: [
      { label: "Price", values: products.map((product) => product.price.toString()) },
      {
        label: "Was",
        values: products.map((product) =>
          product.compareAtPrice ? product.compareAtPrice.toString() : "—"
        )
      },
      {
        label: "You save",
        values: products.map((product) => savingFor(product))
      },
      { label: "Availability", values: products.map((product) => availabilityLabelFor(product)) },
      { label: "Category", values: products.map((product) => product.category?.name ?? "—") },
      {
        label: "Options",
        values: configurations.map((configuration) =>
          configuration.attributes.length
            ? configuration.attributes.map((attribute) => attribute.name).join(", ")
            : "One option"
        )
      },
      {
        label: "View",
        values: products.map((product) => productHref(basePath, product.slug))
      }
    ]
  };
}

function savingFor(product: { compareAtPrice: unknown; price: unknown }) {
  const price = Number(product.price);
  const was = product.compareAtPrice === null ? 0 : Number(product.compareAtPrice);

  if (!Number.isFinite(was) || !Number.isFinite(price) || was <= price) {
    return "—";
  }

  return (was - price).toFixed(2);
}

export async function listCatalogueCategories(storeId: string) {
  const categories = await getStorefrontCategories(storeId);

  return {
    categories: categories.map((category) => ({
      name: category.name,
      slug: category.slug
    }))
  };
}

/**
 * What the shopper has to agree to before an order can exist.
 *
 * The shipping rate ids are the important half: `checkoutSchema` takes an id,
 * not a district name, so without this tool the model cannot propose an order at
 * all — which is the intended failure. `phoneVerificationRequired` is the other
 * half, and it is why the agent knows in advance that a cash-on-delivery order
 * at this shop has to finish on the checkout page.
 */
export async function readStoreInfo(
  store: { currency: string; id: string; name: string },
  basePath: string
) {
  const [paymentMethods, shippingRates, phoneVerificationRequired] = await Promise.all([
    getEnabledPaymentMethods(store.id),
    getEnabledShippingRates(store.id),
    isCheckoutPhoneOtpRequired(store.id)
  ]);

  return {
    cartUrl: `${basePath}/cart`,
    checkoutUrl: `${basePath}/checkout`,
    currency: store.currency,
    paymentMethods: paymentMethods.map((method) => ({
      description: method.description,
      /** Manual wallets need a transaction id the shopper has to have paid to get. */
      needsPaymentReference: isManualPaymentType(method.type),
      name: method.name,
      type: method.type
    })),
    phoneVerificationRequired,
    shippingRates: shippingRates.map((rate) => ({
      amount: rate.amount.toString(),
      area: rate.area,
      city: rate.city,
      district: rate.district,
      id: rate.id,
      name: rate.name,
      zone: rate.zone.name
    })),
    storeName: store.name
  };
}

/**
 * The shopper's own cart.
 *
 * Read through `cart.service.ts`, so it is the cookie the storefront header
 * counts and the checkout page prices — not a second basket the agent keeps.
 * Adding from the chat and adding from a product page put a line in the same
 * place, which is what makes the handoff to checkout work at all.
 */
export async function readCartView(
  storeId: string,
  basePath: string
): Promise<ShoppingAgentCartView> {
  const cart = await getCart(storeId);

  return {
    checkoutHref: `${basePath}/checkout`,
    itemCount: cart.totals.itemCount,
    lines: cart.items.map((item) => ({
      lineId: item.lineId,
      lineTotal: item.lineTotal,
      quantity: item.quantity,
      title: item.variantTitle ? `${item.title} — ${item.variantTitle}` : item.title
    })),
    subtotal: cart.totals.subtotal
  };
}

/**
 * A product by id, but only if this store sells it publicly.
 *
 * The re-read is the check: an id the model invented, an id copied from another
 * shop, or an id for something the seller has since hidden all come back null,
 * and the caller drops the card or the Confirm button rather than rendering one
 * that would fail.
 */
export async function findPublicProduct(storeId: string, productId: string) {
  const products = await findPublicProducts(storeId, [productId]);

  return products[0] ?? null;
}

export async function findPublicProducts(storeId: string, productIds: string[]) {
  return getStorefrontProductsByIds(storeId, productIds.slice(0, 12));
}

function truncate(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
