import { prisma } from "@dash/db";
import { notFound } from "next/navigation";
import { ensureDefaultSettingsForStore } from "../settings/settings.service";

export type StorefrontProductSort = "newest" | "price-asc" | "price-desc";

type StorefrontProductQuery = {
  categorySlug?: string | undefined;
  search?: string | undefined;
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
    return store;
  }

  await ensureDefaultSettingsForStore(store.id);

  return prisma.store.findFirst({
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
    return store;
  }

  await ensureDefaultSettingsForStore(store.id);

  return prisma.store.findFirst({
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
}

export async function getStorefrontHomeData(storeId: string) {
  const [products, categories] = await Promise.all([
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
    })
  ]);

  return {
    featuredProducts: products,
    categories
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
    ...(input.take ? { take: input.take } : {})
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
