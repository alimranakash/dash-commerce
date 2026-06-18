import type { Prisma } from "@dash/db";
import type { getStorefrontBySlug, getStorefrontProductBySlug } from "./resolver";

export type StorefrontStore = NonNullable<Awaited<ReturnType<typeof getStorefrontBySlug>>>;
export type StorefrontProduct = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: true;
  };
}>;
export type StorefrontProductDetails = NonNullable<
  Awaited<ReturnType<typeof getStorefrontProductBySlug>>
>;
