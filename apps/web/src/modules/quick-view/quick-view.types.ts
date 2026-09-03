/**
 * Quick View: what the modal is sent, and what it is allowed to know.
 *
 * Two payloads, and the split between them is the point.
 *
 * `QuickViewView` is the seller's layout, resolved once by the storefront layout
 * and published to every card on the page. It is settings only — no product, no
 * store — so a grid of forty-eight cards ships one copy of it rather than
 * forty-eight.
 *
 * `QuickViewProduct` is one product, fetched from the server the moment a
 * shopper opens the modal. It is deliberately *not* built from the card: a card
 * is a snapshot taken when the page rendered, and the modal is a buy box. A
 * price that changed, stock that ran out or a product the seller has since
 * unpublished must not be able to reach a shopper through a grid that has been
 * sitting open in a tab. The server re-reads the catalogue row, exactly as the
 * product page would.
 */

export type QuickViewImage = {
  alt: string | null;
  url: string;
};

/** One sellable option of a product, as the modal's selector reads it. */
export type QuickViewVariant = {
  compareAtPrice: string | null;
  continueSelling: boolean;
  id: string;
  imageUrl: string | null;
  optionSignature: string;
  price: string;
  sku: string | null;
  stockQuantity: number;
  title: string;
};

/**
 * One product, re-read.
 *
 * `price` and `compareAtPrice` are strings because the catalogue holds them as
 * Prisma `Decimal`s, which React refuses to serialise across the server/client
 * boundary — the same reason `ProductCardProduct` exists.
 *
 * `storeId` is here because `/api/cart` needs one, and it is the *server's* own
 * answer to the slug the shopper was already browsing — never something the
 * browser named. The cart re-checks it regardless: `addToCart` looks the product
 * up scoped to the store before it writes a line.
 */
export type QuickViewProduct = {
  allowPreorder: boolean;
  categoryName: string | null;
  compareAtPrice: string | null;
  currency: string;
  /** Already cut to the seller's length by the server. */
  description: string;
  id: string;
  images: QuickViewImage[];
  preorderReleaseAt: string | null;
  price: string;
  /** Whole percent off, or null when there is no saving to claim. */
  savingsPercent: number | null;
  sku: string | null;
  slug: string;
  stockQuantity: number;
  storeId: string;
  title: string;
  /** Active options only; empty for a product that has none. */
  variants: QuickViewVariant[];
};

/**
 * The seller's Quick View, as every card and the modal read it.
 *
 * The buy-box half of this is copied from `productPage` rather than owned here:
 * a shop names and colours its Add to Cart button once, and the modal says the
 * same word the product page says. Only `directCheckoutEnabled` is Quick View's
 * own, because a grid and a product page are two different moments.
 */
export type QuickViewView = {
  addToCartButtonColor: string;
  addToCartButtonRadius: number;
  addToCartText: string;
  buttonLabel: string;
  descriptionEnabled: boolean;
  directCheckoutEnabled: boolean;
  directCheckoutText: string;
  fullDetailsText: string;
  galleryEnabled: boolean;
  quantityEnabled: boolean;
  triggerStyle: "hover" | "always";
  variantEnabled: boolean;
  variantStyle: "buttons" | "dropdown";
  wishlistEnabled: boolean;
};

/** What `/api/storefront/quick-view` answers with. */
export type QuickViewResponse = {
  product: QuickViewProduct;
};
