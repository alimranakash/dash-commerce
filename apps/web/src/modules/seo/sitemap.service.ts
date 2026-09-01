import {
  buildCategorySitemapDocument,
  buildProductSitemapDocument,
  buildSitemapIndexDocument,
  buildStorefrontPagesDocument,
  countProductSitemapPages,
  productSitemapSkip,
  type SitemapSection
} from "./sitemap-documents";
import {
  countSitemapCategories,
  countSitemapProducts,
  findSitemapCategories,
  findSitemapProducts
} from "./sitemap.repository";
import { SITEMAP_URLS_PER_SECTION } from "./sitemap-xml";

/**
 * The database half of the sitemaps: which sections a store has, and the rows
 * behind each one. The shape of the documents themselves is decided in
 * `sitemap-documents.ts`, which is where the reasoning about them lives.
 */

export type SitemapStore = {
  id: string;
  updatedAt: Date;
};

/**
 * The sitemaps this store actually has.
 *
 * Two counts rather than two full reads — the index only needs to know how many
 * documents to name, and the rows are read by the section request that follows.
 *
 * The index is emitted even for a store with a single product, so a catalogue
 * that later grows past one section gains a `products-2.xml` without the
 * address the seller already submitted to Search Console changing.
 */
export async function getStorefrontSitemapSections(storeId: string): Promise<SitemapSection[]> {
  const [categoryCount, productCount] = await Promise.all([
    countSitemapCategories(storeId),
    countSitemapProducts(storeId)
  ]);

  return [
    {
      kind: "pages"
    },
    ...(categoryCount > 0
      ? [
          {
            kind: "categories" as const
          }
        ]
      : []),
    ...Array.from({ length: countProductSitemapPages(productCount) }, (_unused, index) => ({
      kind: "products" as const,
      page: index + 1
    }))
  ];
}

export async function buildStorefrontSitemapIndex(input: { origin: string; storeId: string }) {
  return buildSitemapIndexDocument(input.origin, await getStorefrontSitemapSections(input.storeId));
}

/**
 * One section's document, or null when it is empty for this store — an index
 * entry that has since gone away, or a `products-9` on a store with two pages
 * of them.
 */
export async function buildStorefrontSitemapSection(input: {
  origin: string;
  section: SitemapSection;
  store: SitemapStore;
}): Promise<string | null> {
  if (input.section.kind === "pages") {
    return buildStorefrontPagesDocument(input.origin, input.store.updatedAt);
  }

  if (input.section.kind === "categories") {
    const categories = await findSitemapCategories(input.store.id);

    return categories.length > 0 ? buildCategorySitemapDocument(input.origin, categories) : null;
  }

  const products = await findSitemapProducts({
    skip: productSitemapSkip(input.section.page),
    storeId: input.store.id,
    take: SITEMAP_URLS_PER_SECTION
  });

  return products.length > 0 ? buildProductSitemapDocument(input.origin, products) : null;
}
