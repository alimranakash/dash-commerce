import type { Prisma } from "@dash/db";
import { ensureDemoContentSchema, getDatabaseSchemaName } from "./demo-schema";
import { getDemoPackById } from "./registry";
import type { DemoPack, DemoPackCategory, DemoPackSeedContext } from "./types";

export async function seedDemoPack(tx: Prisma.TransactionClient, context: DemoPackSeedContext) {
  const demoPack = getDemoPackById(context.demoPackId);
  await ensureDemoContentSchema(tx);

  await tx.$executeRawUnsafe(
    `UPDATE "${getDatabaseSchemaName()}"."Store" SET "activeDemoPack" = $1, "demoPackInstalledAt" = NOW() WHERE "id" = $2 AND "organizationId" = $3`,
    demoPack.id,
    context.storeId,
    context.organizationId
  );

  if (demoPack.content.categories.length > 0 || demoPack.content.products.length > 0) {
    await seedCatalogDemoPack(tx, context, demoPack);
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

async function seedCatalogDemoPack(
  tx: Prisma.TransactionClient,
  context: DemoPackSeedContext,
  demoPack: DemoPack
) {
  const categoryBySlug = new Map<string, { id: string; slug: string }>();

  for (const category of demoPack.content.categories) {
    const record = await upsertCategory(tx, context.storeId, demoPack.id, category);
    categoryBySlug.set(category.slug, record);
  }

  for (const product of demoPack.content.products) {
    const category = categoryBySlug.get(product.categorySlug);

    if (!category) {
      throw new Error(`Demo product category "${product.categorySlug}" was not seeded.`);
    }

    const existingProduct = await tx.product.findUnique({
      where: {
        storeId_slug: {
          slug: product.slug,
          storeId: context.storeId
        }
      }
    });

    if (existingProduct && !(await isDemoProduct(tx, existingProduct.id, context.storeId))) {
      continue;
    }

    const productRecord = existingProduct
      ? await tx.product.update({
          data: {
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
            id: existingProduct.id
          }
        })
      : await tx.product.create({
          data: {
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
          }
        });

    await markDemoProduct(tx, productRecord.id, context.storeId, demoPack.id);

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
  demoPackId: string,
  category: DemoPackCategory
) {
  return upsertCategoryRecord(tx, storeId, demoPackId, category);
}

async function upsertCategoryRecord(
  tx: Prisma.TransactionClient,
  storeId: string,
  demoPackId: string,
  category: DemoPackCategory
) {
  const existingCategory = await tx.category.findUnique({
    where: {
      storeId_slug: {
        slug: category.slug,
        storeId
      }
    }
  });

  if (existingCategory && !(await isDemoCategory(tx, existingCategory.id, storeId))) {
    return existingCategory;
  }

  const record = existingCategory
    ? await tx.category.update({
        data: {
          description: category.description ?? null,
          name: category.name
        },
        where: {
          id: existingCategory.id
        }
      })
    : await tx.category.create({
        data: {
          description: category.description ?? null,
          name: category.name,
          slug: category.slug,
          storeId
        }
      });

  await markDemoCategory(tx, record.id, storeId, demoPackId);

  return record;
}

async function isDemoProduct(tx: Prisma.TransactionClient, productId: string, storeId: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ isDemoContent: boolean }>>(
    `SELECT "isDemoContent" FROM "${getDatabaseSchemaName()}"."Product" WHERE "id" = $1 AND "storeId" = $2 LIMIT 1`,
    productId,
    storeId
  );

  return rows[0]?.isDemoContent === true;
}

async function isDemoCategory(tx: Prisma.TransactionClient, categoryId: string, storeId: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ isDemoContent: boolean }>>(
    `SELECT "isDemoContent" FROM "${getDatabaseSchemaName()}"."Category" WHERE "id" = $1 AND "storeId" = $2 LIMIT 1`,
    categoryId,
    storeId
  );

  return rows[0]?.isDemoContent === true;
}

function markDemoProduct(tx: Prisma.TransactionClient, productId: string, storeId: string, demoPackId: string) {
  return tx.$executeRawUnsafe(
    `UPDATE "${getDatabaseSchemaName()}"."Product" SET "isDemoContent" = TRUE, "demoPackId" = $1 WHERE "id" = $2 AND "storeId" = $3`,
    demoPackId,
    productId,
    storeId
  );
}

function markDemoCategory(tx: Prisma.TransactionClient, categoryId: string, storeId: string, demoPackId: string) {
  return tx.$executeRawUnsafe(
    `UPDATE "${getDatabaseSchemaName()}"."Category" SET "isDemoContent" = TRUE, "demoPackId" = $1 WHERE "id" = $2 AND "storeId" = $3`,
    demoPackId,
    categoryId,
    storeId
  );
}
