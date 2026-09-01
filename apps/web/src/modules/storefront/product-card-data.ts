import type { StorefrontProduct } from "./storefront.types";

/**
 * A product as a card reads it, in values React can actually send to a client
 * component.
 *
 * A Prisma row cannot be passed straight to one: `price` and `compareAtPrice`
 * are `Decimal` instances, and React refuses to serialise class instances
 * across the server/client boundary — "Only plain objects can be passed to
 * Client Components. Decimal objects are not supported." Every storefront
 * listing hands its rows to a client card, so they come through here first, and
 * this type is what stops a raw row being passed again: `price: string` will
 * not accept one.
 *
 * It is also the whole payload each card needs and nothing else, so a grid of
 * thirty products no longer ships thirty copies of `costPrice`, `demoPackId`
 * and every image row's `createdAt` to the browser.
 */
export type ProductCardProduct = {
  compareAtPrice: string | null;
  createdAt: string;
  id: string;
  images: Array<{ alt: string | null; url: string }>;
  price: string;
  slug: string;
  stockQuantity: number;
  title: string;
};

export function toProductCardProduct(product: StorefrontProduct): ProductCardProduct {
  return {
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    createdAt: product.createdAt.toISOString(),
    id: product.id,
    images: product.images.map((image) => ({ alt: image.alt, url: image.url })),
    price: product.price.toString(),
    slug: product.slug,
    stockQuantity: product.stockQuantity,
    title: product.title
  };
}

export function toProductCardProducts(products: StorefrontProduct[]): ProductCardProduct[] {
  return products.map(toProductCardProduct);
}
