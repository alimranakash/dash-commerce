import { prisma } from "@dash/db";
import { notFound } from "next/navigation";
import { ensureDefaultSettingsForStore } from "../settings/settings.service";
import { withStoreActiveTemplate } from "./templates/template-store";

export type StorefrontProductSort = "newest" | "price-asc" | "price-desc";

type StorefrontProductQuery = {
  categorySlug?: string | undefined;
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
  return prisma.category.findFirst({
    where: {
      slug: categorySlug,
      storeId
    }
  });
}

export async function getStorefrontProductBySlug(storeId: string, productSlug: string) {
  return prisma.product.findFirst({
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
}

export async function getRelatedStorefrontProducts(input: {
  categoryId: string | null;
  productId: string;
  storeId: string;
}) {
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

function storefrontProductOrderBy(sort: StorefrontProductSort | undefined) {
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

  return {
    updatedAt: "desc" as const
  };
}
