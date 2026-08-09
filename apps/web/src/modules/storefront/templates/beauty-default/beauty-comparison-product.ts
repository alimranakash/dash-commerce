import type { StorefrontProduct } from "../../storefront.types";

// The comparison card lives in a client component, so the Decimal price has to be
// flattened to a string here rather than crossing the server boundary as-is.
export type BeautyComparisonProduct = {
  categoryName: string | null;
  imageAlt: string | null;
  imageUrl: string | null;
  price: string;
  slug: string | null;
  title: string;
};

export function toBeautyComparisonProduct(product: StorefrontProduct): BeautyComparisonProduct {
  const image = product.images[0];

  return {
    categoryName: product.category?.name ?? null,
    imageAlt: image?.alt ?? null,
    imageUrl: image?.url ?? null,
    price: product.price.toString(),
    slug: product.slug,
    title: product.title
  };
}
