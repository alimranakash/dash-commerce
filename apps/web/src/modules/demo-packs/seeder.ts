import { randomUUID } from "node:crypto";
import type { Prisma } from "@dash/db";
import { ensureProductTaxonomySchema } from "../products/product-taxonomy.service";
import { normalizeAdvancedSettings } from "../storefront/customization";
import { ensureDemoContentSchema, getDatabaseSchemaName } from "./demo-schema";
import { getDemoPackById } from "./registry";
import type {
  DemoPack,
  DemoPackCategory,
  DemoPackProduct,
  DemoPackSeedContext
} from "./types";

type TaxonomyType = "BRAND" | "TAG";

export async function seedDemoPack(tx: Prisma.TransactionClient, context: DemoPackSeedContext) {
  const demoPack = getDemoPackById(context.demoPackId);
  await ensureDemoContentSchema(tx);
  await ensureProductTaxonomySchema(tx);

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
      brands: demoPack.content.brands?.length ?? 0,
      categories: demoPack.content.categories.length,
      collections: demoPack.content.collections.length,
      media: demoPack.content.media.length,
      navigation: demoPack.content.navigation.length,
      pages: demoPack.content.pages.length,
      productImages: demoPack.content.products.reduce(
        (total, product) => total + productImages(product).length,
        0
      ),
      products: demoPack.content.products.length,
      tags: demoPack.content.tags?.length ?? 0
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

  const brandIdBySlug = new Map<string, string>();
  const tagIdBySlug = new Map<string, string>();

  for (const brand of demoPack.content.brands ?? []) {
    const id = await upsertTaxonomyItem(tx, context.storeId, demoPack.id, "BRAND", brand);
    brandIdBySlug.set(brand.slug, id);
  }

  for (const tag of demoPack.content.tags ?? []) {
    const id = await upsertTaxonomyItem(tx, context.storeId, demoPack.id, "TAG", tag);
    tagIdBySlug.set(tag.slug, id);
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
    await tx.productImage.createMany({
      data: productImages(product).map((image, position) => ({
        alt: image.alt,
        position,
        productId: productRecord.id,
        url: image.url
      }))
    });

    await setDemoCategoryAssignment(tx, context.storeId, productRecord.id, category.id);
    await setDemoTaxonomyAssignments(
      tx,
      context.storeId,
      productRecord.id,
      "BRAND",
      resolveIds(brandIdBySlug, product.brandSlug ? [product.brandSlug] : [])
    );
    await setDemoTaxonomyAssignments(
      tx,
      context.storeId,
      productRecord.id,
      "TAG",
      resolveIds(tagIdBySlug, product.tagSlugs ?? [])
    );
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
      heroImageUrl: demoPack.content.homepage.heroImageUrl ?? null,
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
      heroImageUrl: demoPack.content.homepage.heroImageUrl ?? null,
      heroSubtitle: demoPack.content.homepage.heroSubtitle ?? null,
      heroTitle: demoPack.content.homepage.heroTitle ?? "Discover quality products for everyday life",
      primaryColor: demoPack.content.settings.primaryColor ?? "#135d66",
      secondaryColor: demoPack.content.settings.secondaryColor ?? null
    },
    where: {
      storeId: context.storeId
    }
  });

  await seedAdvancedSettings(tx, context.storeId, demoPack);
}

/**
 * Section copy lives on ThemeSetting.advancedSettings, which the generated
 * Prisma client may not know about, so it is written with raw SQL the same way
 * the settings repository does. This must run after the ThemeSetting upsert
 * above, since it updates a row rather than creating one.
 */
async function seedAdvancedSettings(
  tx: Prisma.TransactionClient,
  storeId: string,
  demoPack: DemoPack
) {
  if (!demoPack.content.advancedSettings) {
    return;
  }

  const schema = getDatabaseSchemaName();

  await tx.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."ThemeSetting" ADD COLUMN IF NOT EXISTS "advancedSettings" JSONB`
  );
  await tx.$executeRawUnsafe(
    `UPDATE "${schema}"."ThemeSetting" SET "advancedSettings" = $1::jsonb WHERE "storeId" = $2`,
    JSON.stringify(normalizeAdvancedSettings(demoPack.content.advancedSettings)),
    storeId
  );
}

function productImages(product: DemoPackProduct) {
  return product.images && product.images.length > 0
    ? product.images
    : [{ alt: product.imageAlt, url: product.imageUrl }];
}

function resolveIds(idBySlug: Map<string, string>, slugs: string[]) {
  return slugs
    .map((slug) => idBySlug.get(slug))
    .filter((id): id is string => Boolean(id));
}

async function upsertTaxonomyItem(
  tx: Prisma.TransactionClient,
  storeId: string,
  demoPackId: string,
  type: TaxonomyType,
  item: { imageUrl?: string | undefined; name: string; slug: string }
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
    INSERT INTO "${getDatabaseSchemaName()}"."ProductTaxonomy"
      ("id", "storeId", "type", "name", "slug", "imageUrl", "isDemoContent", "demoPackId")
    VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
    ON CONFLICT ("storeId", "type", "slug")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "imageUrl" = EXCLUDED."imageUrl",
      "isDemoContent" = TRUE,
      "demoPackId" = EXCLUDED."demoPackId",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id"
  `,
    randomUUID(),
    storeId,
    type,
    item.name,
    item.slug,
    item.imageUrl ?? null,
    demoPackId
  );

  const id = rows[0]?.id;

  if (!id) {
    throw new Error(`Demo ${type.toLowerCase()} "${item.slug}" could not be seeded.`);
  }

  return id;
}

async function setDemoTaxonomyAssignments(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  type: TaxonomyType,
  taxonomyIds: string[]
) {
  const schema = getDatabaseSchemaName();

  await tx.$executeRawUnsafe(
    `DELETE FROM "${schema}"."ProductTaxonomyAssignment" WHERE "storeId" = $1 AND "productId" = $2 AND "type" = $3`,
    storeId,
    productId,
    type
  );

  for (const taxonomyId of taxonomyIds) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO "${schema}"."ProductTaxonomyAssignment" ("id", "storeId", "productId", "taxonomyId", "type")
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("productId", "taxonomyId", "type") DO NOTHING
    `,
      randomUUID(),
      storeId,
      productId,
      taxonomyId,
      type
    );
  }
}

async function setDemoCategoryAssignment(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  categoryId: string
) {
  const schema = getDatabaseSchemaName();

  await tx.$executeRawUnsafe(
    `DELETE FROM "${schema}"."ProductCategoryAssignment" WHERE "storeId" = $1 AND "productId" = $2`,
    storeId,
    productId
  );
  await tx.$executeRawUnsafe(
    `
    INSERT INTO "${schema}"."ProductCategoryAssignment" ("id", "storeId", "productId", "categoryId")
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ("productId", "categoryId") DO NOTHING
  `,
    randomUUID(),
    storeId,
    productId,
    categoryId
  );
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
          imageUrl: category.imageUrl ?? null,
          name: category.name
        },
        where: {
          id: existingCategory.id
        }
      })
    : await tx.category.create({
        data: {
          description: category.description ?? null,
          imageUrl: category.imageUrl ?? null,
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
