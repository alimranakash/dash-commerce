import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";
import { normalizeSlug } from "../../lib/slug";

export type ProductTaxonomyType = "TAG" | "BRAND" | "ATTRIBUTE";

export type ProductTaxonomyItem = {
  id: string;
  /** Logo for BRAND items; null for tags and attributes. */
  imageUrl: string | null;
  name: string;
  slug: string;
};

type ProductTaxonomyClient = Prisma.TransactionClient | typeof prisma;

let ensurePromise: Promise<void> | null = null;

export async function getProductTaxonomyItems(storeId: string, type: ProductTaxonomyType) {
  await ensureProductTaxonomySchema();
  const taxonomyTable = tableName("ProductTaxonomy");

  return prisma.$queryRawUnsafe<ProductTaxonomyItem[]>(
    `
    SELECT "id", "imageUrl", "name", "slug"
    FROM ${taxonomyTable}
    WHERE "storeId" = $1 AND "type" = $2
    ORDER BY "name" ASC
  `,
    storeId,
    type
  );
}

export async function createProductTaxonomyItem(storeId: string, type: ProductTaxonomyType, name: string) {
  await ensureProductTaxonomySchema();

  const cleanName = name.trim();

  if (cleanName.length < 2) {
    throw new Error(`${taxonomyLabel(type)} name is required.`);
  }

  const slug = await createUniqueTaxonomySlug(storeId, type, cleanName);
  const taxonomyTable = tableName("ProductTaxonomy");

  const rows = await prisma.$queryRawUnsafe<ProductTaxonomyItem[]>(
    `
    INSERT INTO ${taxonomyTable} ("id", "storeId", "type", "name", "slug")
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT ("storeId", "type", "slug")
    DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "imageUrl", "name", "slug"
  `,
    randomUUID(),
    storeId,
    type,
    cleanName,
    slug
  );

  return rows[0];
}

export async function deleteProductTaxonomyItem(storeId: string, type: ProductTaxonomyType, itemId: string) {
  await ensureProductTaxonomySchema();
  const taxonomyTable = tableName("ProductTaxonomy");

  await prisma.$executeRawUnsafe(
    `
    DELETE FROM ${taxonomyTable}
    WHERE "id" = $1 AND "storeId" = $2 AND "type" = $3
  `,
    itemId,
    storeId,
    type
  );
}

export async function getProductTaxonomyIds(storeId: string, productId: string, type: ProductTaxonomyType) {
  await ensureProductTaxonomySchema();
  const assignmentTable = tableName("ProductTaxonomyAssignment");

  const rows = await prisma.$queryRawUnsafe<Array<{ taxonomyId: string }>>(
    `
    SELECT "taxonomyId"
    FROM ${assignmentTable}
    WHERE "storeId" = $1 AND "productId" = $2 AND "type" = $3
    ORDER BY "createdAt" ASC
  `,
    storeId,
    productId,
    type
  );

  return rows.map((row) => row.taxonomyId);
}

export async function getProductCategoryAssignmentIds(storeId: string, productId: string) {
  await ensureProductTaxonomySchema();
  const assignmentTable = tableName("ProductCategoryAssignment");

  const rows = await prisma.$queryRawUnsafe<Array<{ categoryId: string }>>(
    `
    SELECT "categoryId"
    FROM ${assignmentTable}
    WHERE "storeId" = $1 AND "productId" = $2
    ORDER BY "createdAt" ASC
  `,
    storeId,
    productId
  );

  return rows.map((row) => row.categoryId);
}

export async function setProductCatalogSelections(input: {
  brandIds: string[];
  categoryIds: string[];
  productId: string;
  storeId: string;
  tagIds: string[];
}) {
  await ensureProductTaxonomySchema();

  await prisma.$transaction(async (tx) => {
    await setProductCategoryAssignments(tx, input.storeId, input.productId, input.categoryIds);
    await setProductTaxonomyAssignments(tx, input.storeId, input.productId, "TAG", input.tagIds);
    await setProductTaxonomyAssignments(tx, input.storeId, input.productId, "BRAND", input.brandIds);
  });
}

async function setProductCategoryAssignments(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  categoryIds: string[]
) {
  const allowedIds = await getAllowedCategoryIds(tx, storeId);
  const selectedIds = uniqueIds(categoryIds).filter((id) => allowedIds.has(id));
  const assignmentTable = tableName("ProductCategoryAssignment");

  await tx.$executeRawUnsafe(
    `
    DELETE FROM ${assignmentTable}
    WHERE "storeId" = $1 AND "productId" = $2
  `,
    storeId,
    productId
  );

  for (const categoryId of selectedIds) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO ${assignmentTable} ("id", "storeId", "productId", "categoryId")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("productId", "categoryId") DO NOTHING
    `,
      randomUUID(),
      storeId,
      productId,
      categoryId
    );
  }
}

async function setProductTaxonomyAssignments(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  type: ProductTaxonomyType,
  taxonomyIds: string[]
) {
  const allowedIds = await getAllowedTaxonomyIds(tx, storeId, type);
  const selectedIds = uniqueIds(taxonomyIds).filter((id) => allowedIds.has(id));
  const assignmentTable = tableName("ProductTaxonomyAssignment");

  await tx.$executeRawUnsafe(
    `
    DELETE FROM ${assignmentTable}
    WHERE "storeId" = $1 AND "productId" = $2 AND "type" = $3
  `,
    storeId,
    productId,
    type
  );

  for (const taxonomyId of selectedIds) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO ${assignmentTable} ("id", "storeId", "productId", "taxonomyId", "type")
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

async function getAllowedCategoryIds(tx: Prisma.TransactionClient, storeId: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM ${tableName("Category")} WHERE "storeId" = $1`,
    storeId
  );

  return new Set(rows.map((row) => row.id));
}

async function getAllowedTaxonomyIds(tx: Prisma.TransactionClient, storeId: string, type: ProductTaxonomyType) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM ${tableName("ProductTaxonomy")} WHERE "storeId" = $1 AND "type" = $2`,
    storeId,
    type
  );

  return new Set(rows.map((row) => row.id));
}

async function createUniqueTaxonomySlug(storeId: string, type: ProductTaxonomyType, name: string) {
  const baseSlug = normalizeSlug(name) || taxonomyLabel(type).toLowerCase();
  let candidate = baseSlug;
  let counter = 2;

  while (!(await isTaxonomySlugAvailable(storeId, type, candidate))) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

async function isTaxonomySlugAvailable(storeId: string, type: ProductTaxonomyType, slug: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
    SELECT "id"
    FROM ${tableName("ProductTaxonomy")}
    WHERE "storeId" = $1 AND "type" = $2 AND "slug" = $3
    LIMIT 1
  `,
    storeId,
    type,
    slug
  );

  return rows.length === 0;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function taxonomyLabel(type: ProductTaxonomyType) {
  if (type === "TAG") return "Tag";

  return type === "ATTRIBUTE" ? "Attribute" : "Brand";
}

export function ensureProductTaxonomySchema(db: ProductTaxonomyClient = prisma) {
  if (db !== prisma) {
    return createProductTaxonomySchema(db);
  }

  ensurePromise ??= createProductTaxonomySchema(db);

  return ensurePromise;
}

async function createProductTaxonomySchema(db: ProductTaxonomyClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductTaxonomy" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "imageUrl" TEXT,
      "isDemoContent" BOOLEAN NOT NULL DEFAULT FALSE,
      "demoPackId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductTaxonomy_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE
    )
  `);
  // Databases created before brand logos and demo tracking existed.
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."ProductTaxonomy" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."ProductTaxonomy" ADD COLUMN IF NOT EXISTS "isDemoContent" BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."ProductTaxonomy" ADD COLUMN IF NOT EXISTS "demoPackId" TEXT`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ProductTaxonomy_store_type_slug_key" ON "${schema}"."ProductTaxonomy" ("storeId", "type", "slug")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductTaxonomy_store_type_idx" ON "${schema}"."ProductTaxonomy" ("storeId", "type")`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductTaxonomyAssignment" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "taxonomyId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductTaxonomyAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductTaxonomyAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductTaxonomyAssignment_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "${schema}"."ProductTaxonomy"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ProductTaxonomyAssignment_product_taxonomy_type_key" ON "${schema}"."ProductTaxonomyAssignment" ("productId", "taxonomyId", "type")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductTaxonomyAssignment_store_product_idx" ON "${schema}"."ProductTaxonomyAssignment" ("storeId", "productId")`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductCategoryAssignment" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductCategoryAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductCategoryAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductCategoryAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "${schema}"."Category"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategoryAssignment_product_category_key" ON "${schema}"."ProductCategoryAssignment" ("productId", "categoryId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductCategoryAssignment_store_product_idx" ON "${schema}"."ProductCategoryAssignment" ("storeId", "productId")`);
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

function tableName(name: string) {
  const schema = getDatabaseSchemaName().replace(/"/g, '""');
  const table = name.replace(/"/g, '""');

  return `"${schema}"."${table}"`;
}
