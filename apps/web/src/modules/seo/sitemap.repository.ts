import { prisma } from "@dash/db";
import { publicProductWhere } from "../storefront/resolver";
import { SITEMAP_IMAGES_PER_URL, SITEMAP_URLS_PER_SECTION } from "./sitemap-xml";

/**
 * The reads behind the sitemaps. Every one is scoped by `storeId`, and every
 * one narrows products through the storefront's own `publicProductWhere`, so a
 * sitemap can never name a URL the storefront would refuse to render.
 *
 * All of them select the two or three columns a `<url>` entry needs rather than
 * whole rows: a store with thousands of products serialises its catalogue on a
 * single request, and pulling descriptions and prices along for the ride is the
 * difference between a fast sitemap and a timed-out one.
 */

export async function countSitemapProducts(storeId: string) {
  return prisma.product.count({
    where: publicProductWhere(storeId)
  });
}

export async function countSitemapCategories(storeId: string) {
  return prisma.category.count({
    where: {
      storeId,
      products: {
        some: publicProductWhere(storeId)
      }
    }
  });
}

export async function findSitemapProducts(input: { skip: number; storeId: string; take: number }) {
  return prisma.product.findMany({
    where: publicProductWhere(input.storeId),
    select: {
      images: {
        orderBy: {
          position: "asc"
        },
        select: {
          url: true
        },
        take: SITEMAP_IMAGES_PER_URL
      },
      slug: true,
      updatedAt: true
    },
    // Stable, not newest-first. Each page of the sitemap is a separate request,
    // so an order that moves a row when it is edited would drop products out of
    // one page and duplicate them into another between two crawler fetches.
    // Creation order only ever appends, which keeps existing pages fixed.
    orderBy: [
      {
        createdAt: "asc"
      },
      {
        id: "asc"
      }
    ],
    skip: input.skip,
    take: input.take
  });
}

/**
 * Categories a shopper can actually browse.
 *
 * Mirrors `getStorefrontCategories`: an empty category renders a page with
 * nothing on it, which is a thin-content URL rather than a landing page, so it
 * is left out of the sitemap for the same reason the storefront's own category
 * index leaves it out of the navigation.
 */
export async function findSitemapCategories(storeId: string) {
  return prisma.category.findMany({
    where: {
      storeId,
      products: {
        some: publicProductWhere(storeId)
      }
    },
    select: {
      slug: true,
      updatedAt: true
    },
    orderBy: [
      {
        name: "asc"
      },
      {
        id: "asc"
      }
    ],
    take: SITEMAP_URLS_PER_SECTION
  });
}
