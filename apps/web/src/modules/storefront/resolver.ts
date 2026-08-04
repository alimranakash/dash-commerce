import { prisma } from "@dash/db";
import { notFound } from "next/navigation";
import { ensureCategoryImageSchema } from "../categories/category-image-schema";
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
  categorySlug?: string | undefined;
  maxPrice?: number | undefined;
  minPrice?: number | undefined;
  search?: string | undefined;
  skip?: number | undefined;
  sort?: StorefrontProductSort | undefined;
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

export async function getStorefrontByDomain(domain: string) {
  const normalizedDomain = domain.toLowerCase().trim();
  const store = await prisma.store.findFirst({
    where: {
      domains: {
        some: {
          domain: normalizedDomain
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

export async function getStorefrontHomeData(storeId: string) {
  await ensureCategoryImageSchema();

  const [products, categories, newArrivals, bestSellers] = await Promise.all([
    getStorefrontProducts(storeId, 8),
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
      take: 8
    }),
    getBestSellingStorefrontProducts(storeId, 8)
  ]);

  return {
    featuredProducts: products,
    categories,
    newArrivals,
    bestSellers
  };
}

export async function getStorefrontProducts(
  storeId: string,
  inputOrTake?: StorefrontProductQuery | number
) {
  await ensureCategoryImageSchema();

  const input = typeof inputOrTake === "number" ? { take: inputOrTake } : (inputOrTake ?? {});
  const search = input.search?.trim();

  return prisma.product.findMany({
    where: {
      ...publicProductWhere(storeId),
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

  return prisma.product.count({
    where: {
      ...publicProductWhere(storeId),
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
    take: 4
  });
}

async function getBestSellingStorefrontProducts(storeId: string, take: number) {
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
        }
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

export function getPrimaryStorefrontDomain(
  store: NonNullable<Awaited<ReturnType<typeof getStorefrontBySlug>>>
) {
  return store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
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
