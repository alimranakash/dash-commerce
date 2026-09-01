import { prisma } from "@dash/db";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ensureCategoryImageSchema } from "../categories/category-image-schema";
import {
  getCartCrossSellProducts,
  getCoPurchasedStorefrontProducts,
  getPairedStorefrontProducts
} from "../merchandising/merchandising.service";
import { getProductIdsByTaxonomySlug } from "../products/product-taxonomy.service";
import { getProductVariantConfiguration } from "../products/product-variants.service";
import { getSearchResultsForStore } from "../search/search.service";
import { ensureDefaultSettingsForStore } from "../settings/settings.service";
import { withStoreActiveTemplate } from "./templates/template-store";

export type StorefrontProductSort =
  | "alpha-asc"
  | "alpha-desc"
  | "best-selling"
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "relevance";

type StorefrontProductQuery = {
  availability?: "in-stock" | "out-of-stock" | undefined;
  brandSlug?: string | undefined;
  categorySlug?: string | undefined;
  maxPrice?: number | undefined;
  minPrice?: number | undefined;
  search?: string | undefined;
  skip?: number | undefined;
  sort?: StorefrontProductSort | undefined;
  tagSlug?: string | undefined;
  take?: number | undefined;
};

/**
 * The store behind a storefront slug.
 *
 * Request-scoped rather than plain, because one storefront render asks for it
 * three times over — the layout's metadata, the layout itself, and the page —
 * and each of those was its own query. `cache` collapses them into one for the
 * length of a request and changes nothing else: the settings backfill below is
 * idempotent, and the next request still reads fresh rows.
 */
export const getStorefrontBySlug = cache(loadStorefrontBySlug);

async function loadStorefrontBySlug(slug: string) {
  const store = await prisma.store.findFirst({
    where: {
      slug,
      status: {
        in: ["ACTIVE", "DRAFT"]
      }
    },
    include: {
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      },
      setting: true,
      themeSetting: true
    }
  });

  if (!store) {
    return null;
  }

  if (store.setting && store.themeSetting) {
    return withStoreActiveTemplate(store);
  }

  await ensureDefaultSettingsForStore(store.id);

  const refreshedStore = await prisma.store.findFirst({
    where: {
      id: store.id
    },
    include: {
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      },
      setting: true,
      themeSetting: true
    }
  });

  return refreshedStore ? withStoreActiveTemplate(refreshedStore) : null;
}

/**
 * Resolves the store a public hostname belongs to.
 *
 * A `CUSTOM` row must be verified to resolve. Adding a row is self-service, so
 * without that check anyone could enter a hostname they do not control and have
 * us serve their store on it the moment the real owner's DNS pointed here — or
 * simply squat the name. `DASH_SUBDOMAIN` rows are issued by us at store
 * creation and carry no `verifiedAt`, so they resolve on their own.
 */
export async function getStorefrontByDomain(domain: string) {
  const normalizedDomain = domain.toLowerCase().trim();
  const store = await prisma.store.findFirst({
    where: {
      domains: {
        some: {
          domain: normalizedDomain,
          OR: [
            {
              type: "DASH_SUBDOMAIN"
            },
            {
              type: "CUSTOM",
              verifiedAt: {
                not: null
              }
            }
          ]
        }
      },
      status: {
        in: ["ACTIVE", "DRAFT"]
      }
    },
    include: {
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      },
      setting: true,
      themeSetting: true
    }
  });

  if (!store) {
    return null;
  }

  if (store.setting && store.themeSetting) {
    return withStoreActiveTemplate(store);
  }

  await ensureDefaultSettingsForStore(store.id);

  const refreshedStore = await prisma.store.findFirst({
    where: {
      id: store.id
    },
    include: {
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      },
      setting: true,
      themeSetting: true
    }
  });

  return refreshedStore ? withStoreActiveTemplate(refreshedStore) : null;
}

// Homepage rows used to be capped at 8 cards, which silently truncated a
// "Products shown" setting above that. The caller passes the largest count any
// product section asks for.
const DEFAULT_HOME_PRODUCTS_TAKE = 8;

export async function getStorefrontHomeData(storeId: string, take = DEFAULT_HOME_PRODUCTS_TAKE) {
  await ensureCategoryImageSchema();

  const productsTake = Math.max(DEFAULT_HOME_PRODUCTS_TAKE, Math.round(take));
  const [products, categories, newArrivals, bestSellers, trending] = await Promise.all([
    getStorefrontProducts(storeId, productsTake),
    prisma.category.findMany({
      where: {
        storeId,
        products: {
          some: {
            status: "ACTIVE",
            visibility: "PUBLIC"
          }
        }
      },
      orderBy: {
        name: "asc"
      },
      take: 6
    }),
    getStorefrontProducts(storeId, {
      sort: "newest",
      take: productsTake
    }),
    getBestSellingStorefrontProducts(storeId, productsTake),
    getTrendingStorefrontProducts(storeId, productsTake)
  ]);

  return {
    featuredProducts: products,
    categories,
    newArrivals,
    bestSellers,
    trending
  };
}

export async function getStorefrontProducts(
  storeId: string,
  inputOrTake?: StorefrontProductQuery | number
) {
  await ensureCategoryImageSchema();

  const input = typeof inputOrTake === "number" ? { take: inputOrTake } : (inputOrTake ?? {});
  const search = input.search?.trim();
  const taxonomyWhere = await taxonomyProductWhere(storeId, input);
  const matches = search ? (await getSearchResultsForStore(storeId, search)).matches : null;

  if (matches && matches.length === 0) {
    return [];
  }

  const where = {
    ...publicProductWhere(storeId),
    ...taxonomyWhere,
    ...(input.categorySlug
      ? {
          category: {
            slug: input.categorySlug
          }
        }
      : {}),
    ...priceWhere(input.minPrice, input.maxPrice),
    ...availabilityWhere(input.availability),
    ...searchIdWhere(taxonomyWhere, matches)
  };
  const include = {
    category: true,
    images: {
      orderBy: {
        position: "asc" as const
      }
    }
  };

  if (!matches || (input.sort && input.sort !== "relevance")) {
    return prisma.product.findMany({
      where,
      include,
      orderBy: storefrontProductOrderBy(input.sort),
      ...(input.skip ? { skip: input.skip } : {}),
      ...(input.take ? { take: input.take } : {})
    });
  }

  // Relevance is a per-query score, not a column, so Prisma cannot order by it.
  // The candidate set the search service returns is capped, which is what keeps
  // sorting and paginating in memory here affordable.
  const ranks = new Map(matches.map((match) => [match.productId, match.rank]));
  const products = await prisma.product.findMany({ where, include });
  const ranked = products.sort(
    (first, second) => (ranks.get(second.id) ?? 0) - (ranks.get(first.id) ?? 0)
  );
  const skip = input.skip ?? 0;

  return input.take ? ranked.slice(skip, skip + input.take) : ranked.slice(skip);
}

/**
 * Narrows to the products search matched, without losing a taxonomy filter that
 * already narrowed by id — a brand filter and a search box are both allowed to
 * be active at once, so the two id sets intersect rather than overwrite.
 */
function searchIdWhere(
  taxonomyWhere: { id?: { in: string[] } },
  matches: Array<{ productId: string }> | null
) {
  if (!matches) {
    return {};
  }

  const matchedIds = matches.map((match) => match.productId);
  const taxonomyIds = taxonomyWhere.id?.in;

  return {
    id: {
      in: taxonomyIds ? matchedIds.filter((id) => taxonomyIds.includes(id)) : matchedIds
    }
  };
}

export async function getStorefrontProductCount(storeId: string, input?: StorefrontProductQuery) {
  const search = input?.search?.trim();
  const taxonomyWhere = await taxonomyProductWhere(storeId, input ?? {});
  const matches = search ? (await getSearchResultsForStore(storeId, search)).matches : null;

  if (matches && matches.length === 0) {
    return 0;
  }

  return prisma.product.count({
    where: {
      ...publicProductWhere(storeId),
      ...taxonomyWhere,
      ...(input?.categorySlug
        ? {
            category: {
              slug: input.categorySlug
            }
          }
        : {}),
      ...priceWhere(input?.minPrice, input?.maxPrice),
      ...availabilityWhere(input?.availability),
      ...searchIdWhere(taxonomyWhere, matches)
    }
  });
}

export async function getStorefrontCategories(storeId: string) {
  await ensureCategoryImageSchema();

  return prisma.category.findMany({
    where: {
      storeId,
      products: {
        some: publicProductWhere(storeId)
      }
    },
    orderBy: {
      name: "asc"
    }
  });
}

/** Request-scoped: the category page reads it for its metadata and its body. */
export const getStorefrontCategoryBySlug = cache(loadStorefrontCategoryBySlug);

async function loadStorefrontCategoryBySlug(storeId: string, categorySlug: string) {
  await ensureCategoryImageSchema();

  return prisma.category.findFirst({
    where: {
      slug: categorySlug,
      storeId
    }
  });
}

/**
 * Request-scoped for the same reason: the product page reads the product once
 * for its metadata and once for its body.
 */
export const getStorefrontProductBySlug = cache(loadStorefrontProductBySlug);

async function loadStorefrontProductBySlug(storeId: string, productSlug: string) {
  await ensureCategoryImageSchema();

  const product = await prisma.product.findFirst({
    where: {
      ...publicProductWhere(storeId),
      slug: productSlug
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    }
  });

  if (!product) {
    return null;
  }

  const variantConfiguration = await getProductVariantConfiguration(storeId, product.id);

  return {
    ...product,
    variantConfiguration
  };
}

/**
 * Named products, in the order they were asked for.
 *
 * For surfaces that already hold ids and need the rows behind them — the AI
 * Shopping Agent re-reading the products a model named before it will draw a
 * card for one. It goes through `publicProductWhere` like every other read in
 * this file, which is the point: an id for a DRAFT, HIDDEN or another store's
 * product simply does not come back, so a caller cannot surface one by holding
 * its id.
 *
 * The order is restored afterwards because the database has no opinion about it
 * and a comparison table's columns have to line up with the sentence above them.
 */
export async function getStorefrontProductsByIds(storeId: string, productIds: string[]) {
  const unique = [...new Set(productIds.filter(Boolean))];

  if (unique.length === 0) {
    return [];
  }

  await ensureCategoryImageSchema();

  const products = await prisma.product.findMany({
    where: {
      ...publicProductWhere(storeId),
      id: {
        in: unique
      }
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    }
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return unique
    .map((id) => byId.get(id))
    .filter((product): product is (typeof products)[number] => product !== undefined);
}

/**
 * The rail under a product, filled from three sources in falling order of how
 * much each one actually knows:
 *
 * 1. what the seller paired by hand — the only rows carrying a decision;
 * 2. what this store's own shoppers bought in the same order;
 * 3. the rest of the product's category, which is a guess and is what the rail
 *    was made of before there was anything better.
 *
 * Each step only runs when the one above it left the rail short, so a store
 * with good pairings never pays for the co-purchase query.
 */
export async function getRelatedStorefrontProducts(input: {
  categoryId: string | null;
  productId: string;
  storeId: string;
  take?: number | undefined;
}) {
  await ensureCategoryImageSchema();

  const take = Math.max(1, Math.round(input.take ?? 4));
  const paired = await getPairedStorefrontProducts({
    productId: input.productId,
    storeId: input.storeId,
    take
  });

  if (paired.length >= take) {
    return paired;
  }

  const coPurchased = await getCoPurchasedStorefrontProducts({
    excludeProductIds: paired.map((product) => product.id),
    productId: input.productId,
    storeId: input.storeId,
    take: take - paired.length
  });
  const chosen = [...paired, ...coPurchased];

  if (chosen.length >= take || !input.categoryId) {
    return chosen;
  }

  const fill = await prisma.product.findMany({
    where: {
      ...publicProductWhere(input.storeId),
      categoryId: input.categoryId,
      id: {
        notIn: [input.productId, ...chosen.map((product) => product.id)]
      }
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: take - chosen.length
  });

  return [...chosen, ...fill];
}


/**
 * What to offer beside a cart, for the rail in the drawer and on the cart page.
 *
 * Same order of confidence as the product rail: the seller's pairings, then
 * this store's co-purchase history, then — only to fill the row out — its best
 * sellers, which is the weakest of the three but is at least something the
 * store's shoppers have actually bought.
 *
 * The best sellers are read first and handed down as a fallback rather than
 * fetched only when needed. One extra grouped read against a table the rest of
 * this page has already touched is cheaper than the round trip it would save.
 */
export async function getCartCrossSellRail(input: {
  cartProductIds: string[];
  storeId: string;
  take: number;
}) {
  if (input.cartProductIds.length === 0 || input.take <= 0) {
    return [];
  }

  await ensureCategoryImageSchema();

  const bestSellers = await getBestSellingStorefrontProducts(input.storeId, input.take * 3);

  return getCartCrossSellProducts({
    cartProductIds: input.cartProductIds,
    fallbackProductIds: bestSellers.map((product) => product.id),
    storeId: input.storeId,
    take: input.take
  });
}

// "Trending" is order volume over the last 30 days, so it can differ from the
// all-time best sellers. Stores with no recent orders get an empty pool and the
// section falls back to its featured products.
export async function getTrendingStorefrontProducts(storeId: string, take: number) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  return getBestSellingStorefrontProducts(storeId, take, since);
}

export async function getBestSellingStorefrontProducts(storeId: string, take: number, since?: Date) {
  const bestSellingGroups = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: "desc"
      }
    },
    take,
    where: {
      productId: {
        not: null
      },
      order: {
        storeId,
        status: {
          not: "CANCELLED"
        },
        ...(since ? { createdAt: { gte: since } } : {})
      }
    }
  });
  const productIds = bestSellingGroups
    .map((group) => group.productId)
    .filter((productId): productId is string => Boolean(productId));

  if (productIds.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: {
      ...publicProductWhere(storeId),
      id: {
        in: productIds
      }
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    }
  });
  const productOrder = new Map(productIds.map((productId, index) => [productId, index]));

  return products.sort((left, right) => {
    return (productOrder.get(left.id) ?? 0) - (productOrder.get(right.id) ?? 0);
  });
}

export async function requireStorefrontBySlug(slug: string) {
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    notFound();
  }

  return store;
}

export async function requireStorefrontByDomain(domain: string) {
  const store = await getStorefrontByDomain(domain);

  if (!store) {
    notFound();
  }

  return store;
}

/**
 * The store's canonical public hostname. Unverified custom rows are excluded for
 * the same reason they do not resolve: a hostname we cannot prove points at us is
 * not an address to show customers.
 */
export function getPrimaryStorefrontDomain(
  store: NonNullable<Awaited<ReturnType<typeof getStorefrontBySlug>>>
) {
  const servable = store.domains.filter(
    (domain) => domain.type === "DASH_SUBDOMAIN" || domain.verifiedAt !== null
  );

  return servable.find((domain) => domain.isPrimary) ?? servable[0];
}

// Brands and tags live in the raw-SQL taxonomy tables the generated Prisma
// client does not know about, so they narrow the query by product id.
async function taxonomyProductWhere(storeId: string, input: StorefrontProductQuery) {
  const brandSlug = input.brandSlug?.trim();
  const tagSlug = input.tagSlug?.trim();

  if (!brandSlug && !tagSlug) {
    return {};
  }

  const [brandIds, tagIds] = await Promise.all([
    brandSlug ? getProductIdsByTaxonomySlug(storeId, "BRAND", brandSlug) : Promise.resolve(null),
    tagSlug ? getProductIdsByTaxonomySlug(storeId, "TAG", tagSlug) : Promise.resolve(null)
  ]);
  const matched = [brandIds, tagIds].filter((ids): ids is string[] => Array.isArray(ids));
  const productIds = matched.reduce<string[]>(
    (current, ids, index) => (index === 0 ? ids : current.filter((id) => ids.includes(id))),
    []
  );

  return {
    id: {
      in: productIds
    }
  };
}

/**
 * The one definition of "a shopper may see this product".
 *
 * Exported because the sitemap has to narrow by exactly the same predicate the
 * storefront reads with: a DRAFT or HIDDEN product can no more be submitted to
 * a crawler than linked from a category page, and a second copy of the clause
 * is a second place for that to stop being true.
 */
export function publicProductWhere(storeId: string) {
  return {
    storeId,
    status: "ACTIVE" as const,
    visibility: "PUBLIC" as const
  };
}

function availabilityWhere(availability: StorefrontProductQuery["availability"]) {
  if (availability === "in-stock") {
    return {
      stockQuantity: {
        gt: 0
      }
    };
  }

  if (availability === "out-of-stock") {
    return {
      stockQuantity: {
        lte: 0
      }
    };
  }

  return {};
}

function priceWhere(minPrice: number | undefined, maxPrice: number | undefined) {
  const price: {
    gte?: number;
    lte?: number;
  } = {};

  if (typeof minPrice === "number" && Number.isFinite(minPrice)) {
    price.gte = minPrice;
  }

  if (typeof maxPrice === "number" && Number.isFinite(maxPrice)) {
    price.lte = maxPrice;
  }

  return Object.keys(price).length > 0 ? { price } : {};
}

function storefrontProductOrderBy(sort: StorefrontProductSort | undefined) {
  if (sort === "alpha-asc") {
    return {
      title: "asc" as const
    };
  }

  if (sort === "alpha-desc") {
    return {
      title: "desc" as const
    };
  }

  if (sort === "price-asc") {
    return {
      price: "asc" as const
    };
  }

  if (sort === "price-desc") {
    return {
      price: "desc" as const
    };
  }

  if (sort === "newest") {
    return {
      createdAt: "desc" as const
    };
  }

  if (sort === "featured" || sort === "best-selling") {
    return {
      updatedAt: "desc" as const
    };
  }

  return {
    updatedAt: "desc" as const
  };
}
