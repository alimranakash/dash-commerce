import type { Prisma } from "@dash/db";
import { getDemoPackById } from "./registry";
import type { DemoPack, DemoPackCategory, DemoPackSeedContext } from "./types";

export async function seedDemoPack(tx: Prisma.TransactionClient, context: DemoPackSeedContext) {
  const demoPack = getDemoPackById(context.demoPackId);

  await tx.$executeRawUnsafe(
    `UPDATE "${getDatabaseSchemaName()}"."Store" SET "activeDemoPack" = $1 WHERE "id" = $2 AND "organizationId" = $3`,
    demoPack.id,
    context.storeId,
    context.organizationId
  );

  if (demoPack.id === "general-demo-v1") {
    await seedGeneralDemoPack(tx, context, demoPack);
  }

  return {
    demoPackId: demoPack.id,
    imported: {
      categories: demoPack.content.categories.length,
      collections: demoPack.content.collections.length,
      media: demoPack.content.media.length,
      navigation: demoPack.content.navigation.length,
      pages: demoPack.content.pages.length,
      products: demoPack.content.products.length
    }
  };
}

async function seedGeneralDemoPack(
  tx: Prisma.TransactionClient,
  context: DemoPackSeedContext,
  demoPack: DemoPack
) {
  const categoryBySlug = new Map<string, { id: string; slug: string }>();

  for (const category of demoPack.content.categories) {
    const record = await upsertCategory(tx, context.storeId, category);
    categoryBySlug.set(category.slug, record);
  }

  for (const product of demoPack.content.products) {
    const category = categoryBySlug.get(product.categorySlug);

    if (!category) {
      throw new Error(`Demo product category "${product.categorySlug}" was not seeded.`);
    }

    const productRecord = await tx.product.upsert({
      create: {
        categoryId: category.id,
        compareAtPrice: product.compareAtPrice ?? null,
        description: product.description,
        price: product.price,
        shortDescription: product.shortDescription,
        sku: product.sku,
        slug: product.slug,
        status: "ACTIVE",
        stockQuantity: product.stockQuantity,
        storeId: context.storeId,
        title: product.title,
        visibility: "PUBLIC"
      },
      update: {
        categoryId: category.id,
        compareAtPrice: product.compareAtPrice ?? null,
        description: product.description,
        price: product.price,
        shortDescription: product.shortDescription,
        sku: product.sku,
        status: "ACTIVE",
        stockQuantity: product.stockQuantity,
        title: product.title,
        visibility: "PUBLIC"
      },
      where: {
        storeId_slug: {
          slug: product.slug,
          storeId: context.storeId
        }
      }
    });

    await tx.productImage.deleteMany({
      where: {
        productId: productRecord.id
      }
    });
    await tx.productImage.create({
      data: {
        alt: product.imageAlt,
        position: 0,
        productId: productRecord.id,
        url: product.imageUrl
      }
    });
  }

  await tx.storeSetting.upsert({
    create: {
      storeId: context.storeId,
      tagline: demoPack.content.settings.storeTagline ?? null
    },
    update: {
      tagline: demoPack.content.settings.storeTagline ?? null
    },
    where: {
      storeId: context.storeId
    }
  });

  await tx.themeSetting.upsert({
    create: {
      announcementText: demoPack.content.settings.announcementText ?? null,
      featuredSectionTitle: demoPack.content.homepage.featuredSectionTitle ?? "Featured products",
      heroSubtitle: demoPack.content.homepage.heroSubtitle ?? null,
      heroTitle: demoPack.content.homepage.heroTitle ?? "Discover quality products for everyday life",
      primaryColor: demoPack.content.settings.primaryColor ?? "#135d66",
      secondaryColor: demoPack.content.settings.secondaryColor ?? null,
      storeId: context.storeId,
      themeName: "Theme v1"
    },
    update: {
      announcementText: demoPack.content.settings.announcementText ?? null,
      featuredSectionTitle: demoPack.content.homepage.featuredSectionTitle ?? "Featured products",
      heroSubtitle: demoPack.content.homepage.heroSubtitle ?? null,
      heroTitle: demoPack.content.homepage.heroTitle ?? "Discover quality products for everyday life",
      primaryColor: demoPack.content.settings.primaryColor ?? "#135d66",
      secondaryColor: demoPack.content.settings.secondaryColor ?? null
    },
    where: {
      storeId: context.storeId
    }
  });
}

function upsertCategory(
  tx: Prisma.TransactionClient,
  storeId: string,
  category: DemoPackCategory
) {
  return tx.category.upsert({
    create: {
      description: category.description ?? null,
      name: category.name,
      slug: category.slug,
      storeId
    },
    update: {
      description: category.description ?? null,
      name: category.name
    },
    where: {
      storeId_slug: {
        slug: category.slug,
        storeId
      }
    }
  });
}

function getDatabaseSchemaName() {
  const fallbackSchema = "public";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return fallbackSchema;
  }

  try {
    const schema = new URL(connectionString).searchParams.get("schema") ?? fallbackSchema;

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : fallbackSchema;
  } catch {
    return fallbackSchema;
  }
}
