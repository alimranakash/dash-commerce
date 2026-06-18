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

export async function requireStorefrontBySlug(slug: string) {
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    notFound();
  }

  return store;
}
