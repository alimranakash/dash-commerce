import { docsPages } from "../docs/docs-content";
import {
  renderSitemapIndex,
  renderSitemapUrlSet,
  SITEMAP_URLS_PER_SECTION,
  type SitemapUrl
} from "./sitemap-xml";
import { encodeUrlPath, encodeUrlPathSegment, toAbsoluteUrl } from "./url";

/**
 * What goes in a sitemap, and what deliberately does not — expressed as pure
 * functions over rows, so `verify:sitemap` can drive the exact documents a
 * crawler is served without a database in front of it.
 *
 * A sitemap is a list of pages worth indexing, not a list of routes that
 * resolve. The catalogue is in — home, the two listing pages, every browsable
 * category, every public product — and the shopper's own session is out: cart,
 * checkout, account, orders and the thank-you page are per-visitor, and
 * `/search` is an unbounded query space a crawler would enumerate forever.
 * `robots.ts` disallows exactly that set, so the two halves agree.
 *
 * `/<category>` is left out too, though it resolves: it 308s to
 * `/categories/<category>`, and a sitemap of redirects is a sitemap of soft
 * errors.
 */

export type SitemapSection =
  | {
      kind: "categories";
    }
  | {
      kind: "pages";
    }
  | {
      kind: "products";
      page: number;
    };

export type SitemapCategoryRow = {
  slug: string;
  updatedAt: Date;
};

export type SitemapProductRow = {
  images: Array<{
    url: string;
  }>;
  slug: string;
  updatedAt: Date;
};

/** The one address a seller submits to Search Console. */
export const SITEMAP_INDEX_PATH = "/sitemap.xml";

/**
 * The storefront's fixed pages.
 *
 * Home is the store; `/products` and `/categories` are the two entry points a
 * crawler reaches the catalogue through. Everything else under a storefront is
 * either one of those two lists filtered, or the shopper's own session.
 */
const STOREFRONT_PAGES = [
  {
    changeFrequency: "daily",
    path: "/",
    priority: 1
  },
  {
    changeFrequency: "daily",
    path: "/products",
    priority: 0.9
  },
  {
    changeFrequency: "weekly",
    path: "/categories",
    priority: 0.7
  }
] as const satisfies ReadonlyArray<{
  changeFrequency: NonNullable<SitemapUrl["changeFrequency"]>;
  path: string;
  priority: number;
}>;

export function sitemapSectionPath(section: SitemapSection) {
  if (section.kind === "pages") {
    return "/sitemap/pages.xml";
  }

  if (section.kind === "categories") {
    return "/sitemap/categories.xml";
  }

  return `/sitemap/products-${section.page}.xml`;
}

/**
 * Reads a section name back off the URL, or null for anything that is not one
 * of ours — which the route turns into a 404 rather than an empty document, so
 * a crawler that guessed an address is told the page does not exist instead of
 * being handed a sitemap claiming the store is empty.
 */
export function parseSitemapSection(name: string): SitemapSection | null {
  if (name === "pages.xml") {
    return {
      kind: "pages"
    };
  }

  if (name === "categories.xml") {
    return {
      kind: "categories"
    };
  }

  const productsMatch = /^products-([1-9][0-9]{0,4})\.xml$/.exec(name);

  if (!productsMatch?.[1]) {
    return null;
  }

  return {
    kind: "products",
    page: Number(productsMatch[1])
  };
}

/** How many product sitemaps a catalogue of this size needs. */
export function countProductSitemapPages(productCount: number) {
  return Math.ceil(Math.max(0, productCount) / SITEMAP_URLS_PER_SECTION);
}

export function productSitemapSkip(page: number) {
  return (page - 1) * SITEMAP_URLS_PER_SECTION;
}

/**
 * The index document.
 *
 * No `<lastmod>` on its entries: an honest one needs the newest `updatedAt`
 * inside each page of products, which is a query per section, and a guessed one
 * is worse than none — a crawler that trusts a stale timestamp skips the whole
 * section. The per-URL timestamps inside each document carry the real answer.
 */
export function buildSitemapIndexDocument(origin: string, sections: SitemapSection[]) {
  return renderSitemapIndex(
    sections.map((section) => ({
      loc: `${origin}${sitemapSectionPath(section)}`
    }))
  );
}

export function buildStorefrontPagesDocument(origin: string, lastModified: Date) {
  return renderSitemapUrlSet(
    STOREFRONT_PAGES.map((page) => ({
      changeFrequency: page.changeFrequency,
      lastModified,
      loc: `${origin}${page.path}`,
      priority: page.priority
    }))
  );
}

export function buildCategorySitemapDocument(origin: string, categories: SitemapCategoryRow[]) {
  return renderSitemapUrlSet(
    categories.map((category) => ({
      changeFrequency: "weekly",
      lastModified: category.updatedAt,
      loc: `${origin}/categories/${encodeUrlPathSegment(category.slug)}`,
      priority: 0.7
    }))
  );
}

export function buildProductSitemapDocument(origin: string, products: SitemapProductRow[]) {
  return renderSitemapUrlSet(
    products.map((product) => {
      const imageUrls = product.images
        .map((image) => toAbsoluteUrl(origin, image.url))
        .filter((url): url is string => url !== null);

      return {
        changeFrequency: "weekly",
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
        lastModified: product.updatedAt,
        loc: `${origin}/products/${encodeUrlPathSegment(product.slug)}`,
        priority: 0.8
      } satisfies SitemapUrl;
    })
  );
}

/**
 * The platform's own site: the landing page and the seller handbook.
 *
 * Known at build time and small, so it is a single `<urlset>` with no index
 * above it. `/login`, `/register` and the dashboard are not content; they are
 * disallowed in `robots.ts` rather than listed here.
 */
export function buildMarketingSitemapDocument(origin: string) {
  return renderSitemapUrlSet([
    {
      changeFrequency: "weekly",
      loc: `${origin}/`,
      priority: 1
    },
    {
      changeFrequency: "weekly",
      loc: `${origin}/docs`,
      priority: 0.6
    },
    ...docsPages.map((page) => ({
      changeFrequency: "monthly" as const,
      loc: `${origin}/docs/${encodeUrlPath(page.slug)}`,
      priority: 0.5
    }))
  ]);
}
