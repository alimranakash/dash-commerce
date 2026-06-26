import { prisma } from "@dash/db";
import { notFound } from "next/navigation";
import { ensureDefaultSettingsForStore } from "../settings/settings.service";

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

export async function getStorefrontProducts(storeId: string, take?: number) {
  return prisma.product.findMany({
    where: publicProductWhere(storeId),
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
    ...(take ? { take } : {})
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

export function getPrimaryStorefrontDomain(store: NonNullable<Awaited<ReturnType<typeof getStorefrontBySlug>>>) {
  return store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
}

function publicProductWhere(storeId: string) {
  return {
    storeId,
    status: "ACTIVE" as const,
    visibility: "PUBLIC" as const
  };
}
