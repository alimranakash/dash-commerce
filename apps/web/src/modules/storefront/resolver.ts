import { prisma } from "@dash/db";
import { notFound } from "next/navigation";

export async function getStorefrontBySlug(slug: string) {
  return prisma.store.findFirst({
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
      }
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

function publicProductWhere(storeId: string) {
  return {
    storeId,
    status: "ACTIVE" as const,
    visibility: "PUBLIC" as const
  };
}
