import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";

export type ProductAttributeInput = {
  id?: string;
  name: string;
  position: number;
  values: Array<{
    id?: string;
    name: string;
    position: number;
  }>;
};

export type ProductVariantInput = {
  barcode?: string | null;
  compareAtPrice?: string | null;
  continueSelling?: boolean;
  costPrice?: string | null;
  dimensions?: string | null;
  imageUrl?: string | null;
  lowStockThreshold?: number;
  optionSignature: string;
  options: Record<string, string>;
  price: string;
  shippingClass?: string | null;
  sku?: string | null;
  status: "ACTIVE" | "INACTIVE";
  stockQuantity: number;
  taxClass?: string | null;
  title: string;
  weight?: string | null;
};

export type ProductVariantRecord = ProductVariantInput & {
  id: string;
};

export type CartVariantRecord = Pick<
  ProductVariantRecord,
  "continueSelling" | "id" | "imageUrl" | "price" | "sku" | "status" | "stockQuantity" | "title"
>;

export type ProductVariantConfiguration = {
  attributes: ProductAttributeInput[];
  variants: ProductVariantRecord[];
};

type ProductVariantClient = Prisma.TransactionClient | typeof prisma;

let ensurePromise: Promise<void> | null = null;

export async function getProductVariantConfiguration(storeId: string, productId: string): Promise<ProductVariantConfiguration> {
  await ensureProductVariantSchema();

  const [attributeRows, valueRows, variantRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; position: number }>>(
      `SELECT "id", "name", "position" FROM ${tableName("ProductAttribute")} WHERE "storeId" = $1 AND "productId" = $2 ORDER BY "position" ASC, "createdAt" ASC`,
      storeId,
      productId
    ),
    prisma.$queryRawUnsafe<Array<{ attributeId: string; id: string; name: string; position: number }>>(
      `SELECT "attributeId", "id", "name", "position" FROM ${tableName("ProductAttributeValue")} WHERE "storeId" = $1 AND "productId" = $2 ORDER BY "position" ASC, "createdAt" ASC`,
      storeId,
      productId
    ),
    prisma.$queryRawUnsafe<ProductVariantRecord[]>(
      `SELECT "id", "title", "optionSignature", "options", "sku", "imageUrl", "price", "compareAtPrice", "costPrice", "stockQuantity", "lowStockThreshold", "continueSelling", "status", "barcode", "weight", "dimensions", "taxClass", "shippingClass"
       FROM ${tableName("ProductVariant")}
       WHERE "storeId" = $1 AND "productId" = $2
       ORDER BY "position" ASC, "createdAt" ASC`,
      storeId,
      productId
    )
  ]);

  return {
    attributes: attributeRows.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      position: attribute.position,
      values: valueRows
        .filter((value) => value.attributeId === attribute.id)
        .map((value) => ({
          id: value.id,
          name: value.name,
          position: value.position
        }))
    })),
    variants: variantRows.map((variant) => ({
      ...variant,
      compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : null,
      costPrice: variant.costPrice ? String(variant.costPrice) : null,
      imageUrl: variant.imageUrl ?? null,
      lowStockThreshold: Number(variant.lowStockThreshold ?? 0),
      options: typeof variant.options === "string" ? JSON.parse(variant.options) : variant.options,
      price: String(variant.price),
      stockQuantity: Number(variant.stockQuantity ?? 0)
    }))
  };
}

export async function setProductVariantConfiguration(input: {
  attributes: ProductAttributeInput[];
  productId: string;
  storeId: string;
  variants: ProductVariantInput[];
}) {
  await ensureProductVariantSchema();

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: input.productId,
        storeId: input.storeId
      },
      select: {
        id: true
      }
    });

    if (!product) {
      throw new Error("Product not found.");
    }

    await tx.$executeRawUnsafe(`DELETE FROM ${tableName("ProductVariant")} WHERE "storeId" = $1 AND "productId" = $2`, input.storeId, input.productId);
    await tx.$executeRawUnsafe(`DELETE FROM ${tableName("ProductAttributeValue")} WHERE "storeId" = $1 AND "productId" = $2`, input.storeId, input.productId);
    await tx.$executeRawUnsafe(`DELETE FROM ${tableName("ProductAttribute")} WHERE "storeId" = $1 AND "productId" = $2`, input.storeId, input.productId);

    for (const [attributeIndex, attribute] of input.attributes.entries()) {
      const attributeId = attribute.id || randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO ${tableName("ProductAttribute")} ("id", "storeId", "productId", "name", "position") VALUES ($1, $2, $3, $4, $5)`,
        attributeId,
        input.storeId,
        input.productId,
        attribute.name.trim(),
        attribute.position ?? attributeIndex
      );

      for (const [valueIndex, value] of attribute.values.entries()) {
        await tx.$executeRawUnsafe(
          `INSERT INTO ${tableName("ProductAttributeValue")} ("id", "storeId", "productId", "attributeId", "name", "position") VALUES ($1, $2, $3, $4, $5, $6)`,
          value.id || randomUUID(),
          input.storeId,
          input.productId,
          attributeId,
          value.name.trim(),
          value.position ?? valueIndex
        );
      }
    }

    for (const [variantIndex, variant] of uniqueVariants(input.variants).entries()) {
      await tx.$executeRawUnsafe(
        `INSERT INTO ${tableName("ProductVariant")} (
          "id", "storeId", "productId", "title", "optionSignature", "options", "sku", "imageUrl", "price", "compareAtPrice", "costPrice",
          "stockQuantity", "lowStockThreshold", "continueSelling", "status", "position", "barcode", "weight", "dimensions", "taxClass", "shippingClass"
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::numeric, $10::numeric, $11::numeric, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        randomUUID(),
        input.storeId,
        input.productId,
        variant.title,
        variant.optionSignature,
        JSON.stringify(variant.options),
        variant.sku || null,
        variant.imageUrl || null,
        variant.price || "0",
        variant.compareAtPrice || null,
        variant.costPrice || null,
        variant.stockQuantity ?? 0,
        variant.lowStockThreshold ?? 0,
        Boolean(variant.continueSelling),
        variant.status,
        variantIndex,
        variant.barcode || null,
        variant.weight || null,
        variant.dimensions || null,
        variant.taxClass || null,
        variant.shippingClass || null
      );
    }
  });
}

export async function getProductVariantForCart(storeId: string, productId: string, variantId: string) {
  await ensureProductVariantSchema();

  const rows = await prisma.$queryRawUnsafe<CartVariantRecord[]>(
    `SELECT "id", "title", "sku", "imageUrl", "price", "stockQuantity", "continueSelling", "status"
     FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $3
     LIMIT 1`,
    storeId,
    productId,
    variantId
  );
  const variant = rows[0];

  if (!variant || variant.status === "INACTIVE") {
    throw new Error("This product option is not available.");
  }

  return normalizeCartVariant(variant);
}

export async function decrementProductVariantStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  variantId: string,
  quantity: number
) {
  await ensureProductVariantSchema(tx);

  const rows = await tx.$queryRawUnsafe<CartVariantRecord[]>(
    `SELECT "id", "title", "sku", "imageUrl", "price", "stockQuantity", "continueSelling", "status"
     FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $3
     LIMIT 1`,
    storeId,
    productId,
    variantId
  );
  const variant = rows[0] ? normalizeCartVariant(rows[0]) : null;

  if (!variant || variant.status === "INACTIVE") {
    throw new Error("This product option is no longer available.");
  }

  if (!variant.continueSelling && quantity > variant.stockQuantity) {
    throw new Error(`${variant.title} does not have enough stock.`);
  }

  await tx.$executeRawUnsafe(
    `UPDATE ${tableName("ProductVariant")}
     SET "stockQuantity" = "stockQuantity" - $4, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $3`,
    storeId,
    productId,
    variantId,
    quantity
  );

  return variant;
}

function uniqueVariants(variants: ProductVariantInput[]) {
  const seen = new Set<string>();

  return variants.filter((variant) => {
    if (!variant.optionSignature || seen.has(variant.optionSignature)) {
      return false;
    }

    seen.add(variant.optionSignature);
    return true;
  });
}

function normalizeCartVariant(variant: CartVariantRecord): CartVariantRecord {
  return {
    ...variant,
    imageUrl: variant.imageUrl ?? null,
    price: String(variant.price),
    sku: variant.sku ?? null,
    stockQuantity: Number(variant.stockQuantity ?? 0)
  };
}

export function ensureProductVariantSchema(db: ProductVariantClient = prisma) {
  if (db !== prisma) {
    return createProductVariantSchema(db);
  }

  ensurePromise ??= createProductVariantSchema(db);

  return ensurePromise;
}

async function createProductVariantSchema(db: ProductVariantClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductAttribute" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductAttribute_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductAttribute_store_product_idx" ON "${schema}"."ProductAttribute" ("storeId", "productId")`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductAttributeValue" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "attributeId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductAttributeValue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "${schema}"."ProductAttribute"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductAttributeValue_store_product_idx" ON "${schema}"."ProductAttributeValue" ("storeId", "productId")`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductVariant" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "optionSignature" TEXT NOT NULL,
      "options" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "sku" TEXT,
      "imageUrl" TEXT,
      "price" NUMERIC(12, 2) NOT NULL DEFAULT 0,
      "compareAtPrice" NUMERIC(12, 2),
      "costPrice" NUMERIC(12, 2),
      "stockQuantity" INTEGER NOT NULL DEFAULT 0,
      "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
      "continueSelling" BOOLEAN NOT NULL DEFAULT FALSE,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "position" INTEGER NOT NULL DEFAULT 0,
      "barcode" TEXT,
      "weight" TEXT,
      "dimensions" TEXT,
      "taxClass" TEXT,
      "shippingClass" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductVariant_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_product_signature_key" ON "${schema}"."ProductVariant" ("productId", "optionSignature")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductVariant_store_product_idx" ON "${schema}"."ProductVariant" ("storeId", "productId")`);
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
