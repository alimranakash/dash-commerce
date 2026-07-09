import type { StorefrontProduct } from "../../storefront.types";

export type FashionProductCardData = {
  category: {
    name: string;
    slug: string;
  } | null;
  compareAtPrice: string | null;
  id: string | null;
  images: Array<{
    alt: string | null;
    url: string;
  }>;
  isNew: boolean;
  price: string;
  slug: string | null;
  stockQuantity: number;
  storeId: string | null;
  title: string;
};

export function toFashionProductCardData(product: StorefrontProduct): FashionProductCardData {
  return {
    category: product.category
      ? {
          name: product.category.name,
          slug: product.category.slug
        }
      : null,
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    id: product.id,
    images: product.images.map((image) => ({
      alt: image.alt,
      url: image.url
    })),
    isNew: Date.now() - product.createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000,
    price: product.price.toString(),
    slug: product.slug,
    stockQuantity: product.stockQuantity,
    storeId: product.storeId,
    title: product.title
  };
}
