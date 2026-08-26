/**
 * One cross-sell suggestion, flattened off the storefront product before it
 * crosses into the browser — the rail needs four fields and the full record
 * carries far more, including the cost price.
 *
 * This lives outside the component file because the cart page maps into it on
 * the server, and a function exported from a "use client" module is a client
 * reference there rather than something callable.
 */
export type CartCrossSellProduct = {
  compareAtPrice: string | null;
  id: string;
  imageUrl: string | null;
  price: string;
  title: string;
};

export function toCartCrossSellProduct(product: {
  compareAtPrice: { toString(): string } | null;
  id: string;
  images: Array<{ url: string }>;
  price: { toString(): string };
  title: string;
}): CartCrossSellProduct {
  return {
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : null,
    id: product.id,
    imageUrl: product.images[0]?.url ?? null,
    price: product.price.toString(),
    title: product.title
  };
}
