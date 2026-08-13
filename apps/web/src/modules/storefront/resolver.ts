import { prisma } from "@dash/db";
import { notFound } from "next/navigation";
import { ensureCategoryImageSchema } from "../categories/category-image-schema";
import { getProductIdsByTaxonomySlug } from "../products/product-taxonomy.service";
import { getProductVariantConfiguration } from "../products/product-variants.service";
import { ensureDefaultSettingsForStore } from "../settings/settings.service";
import { withStoreActiveTemplate } from "./templates/template-store";

export type StorefrontProductSort =
  | "alpha-asc"
  | "alpha-desc"
  | "best-selling"
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc";

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

export async function getStorefrontBySlug(slug: string) {
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

  return prisma.product.findMany({
    where: {
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
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive" as const
                }
              },
              {
                sku: {
                  contains: search,
                  mode: "insensitive" as const
                }
              }
            ]
          }
        : {})
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    },
    orderBy: storefrontProductOrderBy(input.sort),
    ...(input.skip ? { skip: input.skip } : {}),
    ...(input.take ? { take: input.take } : {})
  });
}

export async function getStorefrontProductCount(storeId: string, input?: StorefrontProductQuery) {
  const search = input?.search?.trim();
  const taxonomyWhere = await taxonomyProductWhere(storeId, input ?? {});

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
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive" as const
                }
              },
              {
                sku: {
                  contains: search,
                  mode: "insensitive" as const
                }
              }
            ]
          }
        : {})
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

export async function getStorefrontCategoryBySlug(storeId: string, categorySlug: string) {
  await ensureCategoryImageSchema();

  return prisma.category.findFirst({
    where: {
      slug: categorySlug,
      storeId
    }
  });
}

export async function getStorefrontProductBySlug(storeId: string, productSlug: string) {
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

export async function getRelatedStorefrontProducts(input: {
  categoryId: string | null;
  productId: string;
  storeId: string;
  take?: number | undefined;
}) {
  await ensureCategoryImageSchema();

  if (!input.categoryId) {
    return [];
  }

  return prisma.product.findMany({
    where: {
      ...publicProductWhere(input.storeId),
      categoryId: input.categoryId,
      id: {
        not: input.productId
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
    take: Math.max(1, Math.round(input.take ?? 4))
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

function publicProductWhere(storeId: string) {
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
