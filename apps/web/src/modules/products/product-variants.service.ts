import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";
import { normalizeBarcodeValue, optionalBarcodeSchema } from "../barcodes/barcode.schema";

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
  /**
   * The barcode the editor showed when it loaded, so a save can tell a field
   * the seller changed from one posted back untouched — see
   * `resolveVariantBarcode`. Absent for a variant the editor created.
   */
  loadedBarcode?: string | null | undefined;
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

/**
 * Saves a product's options and the variants they make.
 *
 * A variant is kept by its option signature — the same "Black / M" is updated
 * in place, keeping its id, rather than deleted and inserted afresh. Its id is
 * what a cart cookie, an order line and a sale line hold to say which option
 * was bought, and what puts the stock back when one is cancelled; a new id on
 * every product save left all of those pointing at nothing. Its barcode is the
 * number on stickers already on the shelf. Attributes and their values are
 * still rebuilt each time: nothing outside this product refers to them.
 */
export async function setProductVariantConfiguration(input: {
  attributes: ProductAttributeInput[];
  productId: string;
  storeId: string;
  variants: ProductVariantInput[];
}) {
  await ensureProductVariantSchema();
  // DDL on the table the transaction below writes, so it runs first.
  await ensureVariantBarcodeIndex();

  const existingRows = await prisma.$queryRawUnsafe<Array<{ barcode: string | null; id: string; optionSignature: string }>>(
    `SELECT "id", "optionSignature", "barcode" FROM ${tableName("ProductVariant")} WHERE "storeId" = $1 AND "productId" = $2`,
    input.storeId,
    input.productId
  );
  const existingBySignature = new Map(existingRows.map((row) => [row.optionSignature, row]));
  const variants = uniqueVariants(input.variants).map((variant) => ({
    ...variant,
    barcode: resolveVariantBarcode(variant, existingBySignature.get(variant.optionSignature))
  }));

  await assertVariantBarcodesAvailable(input.storeId, input.productId, variants);

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

    const keptSignatures = variants.map((variant) => variant.optionSignature);
    const keptPlaceholders = keptSignatures.map((_, index) => `$${index + 3}`).join(", ");

    await tx.$executeRawUnsafe(
      `DELETE FROM ${tableName("ProductVariant")} WHERE "storeId" = $1 AND "productId" = $2${keptSignatures.length ? ` AND "optionSignature" NOT IN (${keptPlaceholders})` : ""}`,
      input.storeId,
      input.productId,
      ...keptSignatures
    );
    // Cleared before any is set, so two variants trading barcodes never meet
    // half-way through on the unique index.
    await tx.$executeRawUnsafe(
      `UPDATE ${tableName("ProductVariant")} SET "barcode" = NULL WHERE "storeId" = $1 AND "productId" = $2`,
      input.storeId,
      input.productId
    );
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

    for (const [variantIndex, variant] of variants.entries()) {
      const existing = existingBySignature.get(variant.optionSignature);

      if (existing) {
        await tx.$executeRawUnsafe(
          `UPDATE ${tableName("ProductVariant")} SET
            "title" = $4, "options" = $5::jsonb, "sku" = $6, "imageUrl" = $7, "price" = $8::numeric, "compareAtPrice" = $9::numeric,
            "costPrice" = $10::numeric, "stockQuantity" = $11, "lowStockThreshold" = $12, "continueSelling" = $13, "status" = $14,
            "position" = $15, "barcode" = $16, "weight" = $17, "dimensions" = $18, "taxClass" = $19, "shippingClass" = $20,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1 AND "storeId" = $2 AND "productId" = $3`,
          existing.id,
          input.storeId,
          input.productId,
          variant.title,
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
          variant.barcode,
          variant.weight || null,
          variant.dimensions || null,
          variant.taxClass || null,
          variant.shippingClass || null
        );
        continue;
      }

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
        variant.barcode,
        variant.weight || null,
        variant.dimensions || null,
        variant.taxClass || null,
        variant.shippingClass || null
      );
    }
  });
}

/**
 * The barcode a variant is saved with.
 *
 * An editor that has not touched the field posts back what it loaded. The row
 * may have been given a barcode since — printing a label assigns one — and that
 * code is now on a sticker, so when the posted value is the loaded one the
 * stored value wins. Anything the seller actually typed is normalised the way
 * every barcode is, so a scanner's spelling and the stored one compare equal.
 */
function resolveVariantBarcode(
  variant: ProductVariantInput,
  existing: { barcode: string | null } | undefined
): string | null {
  const posted = normalizeBarcodeValue(variant.barcode ?? "");

  if (existing && variant.loadedBarcode !== undefined && posted === normalizeBarcodeValue(variant.loadedBarcode ?? "")) {
    return existing.barcode;
  }

  const parsed = optionalBarcodeSchema.safeParse(posted);

  if (!parsed.success) {
    throw new Error(`${variant.title}: ${parsed.error.issues[0]?.message ?? "Use a valid barcode."}`);
  }

  return parsed.data;
}

/**
 * One barcode, one thing to sell: a code may belong to one variant or one
 * product in the whole store, or a scan at the till could not say which to
 * ring up. The partial index catches a collision between variants; only this
 * can catch one between a variant and a product, which live in two tables.
 */
async function assertVariantBarcodesAvailable(
  storeId: string,
  productId: string,
  variants: Array<{ barcode: string | null; title: string }>
) {
  const owners = new Map<string, string>();

  for (const variant of variants) {
    if (!variant.barcode) continue;

    const other = owners.get(variant.barcode);

    if (other) {
      throw new Error(`${other} and ${variant.title} have the same barcode. Every option needs its own.`);
    }

    owners.set(variant.barcode, variant.title);
  }

  const codes = [...owners.keys()];

  if (!codes.length) {
    return;
  }

  const placeholders = codes.map((_, index) => `$${index + 3}`).join(", ");
  const [taken] = await prisma.$queryRawUnsafe<Array<{ barcode: string; product: string; title: string }>>(
    `SELECT upper(v."barcode") AS "barcode", v."title", p."title" AS "product"
     FROM ${tableName("ProductVariant")} v JOIN ${tableName("Product")} p ON p."id" = v."productId"
     WHERE v."storeId" = $1 AND v."productId" <> $2 AND upper(v."barcode") IN (${placeholders})
     LIMIT 1`,
    storeId,
    productId,
    ...codes
  );

  if (taken) {
    throw new Error(`${owners.get(taken.barcode) ?? "A variant"}: barcode ${taken.barcode} already belongs to ${taken.product} - ${taken.title}.`);
  }

  const product = await prisma.product.findFirst({
    where: { barcode: { in: codes }, storeId },
    select: { barcode: true, id: true, title: true }
  });

  if (product?.barcode) {
    const title = owners.get(product.barcode) ?? "A variant";

    throw new Error(
      product.id === productId
        ? `${title}: this is also the product's own barcode, so a scan could not tell which to sell.`
        : `${title}: barcode ${product.barcode} already belongs to ${product.title}.`
    );
  }
}

let variantBarcodeIndexPromise: Promise<void> | null = null;

/**
 * A variant's barcode is unique within its store, by a partial index in the
 * shape of `Product_barcode_unique`.
 *
 * Kept out of `createProductVariantSchema` on purpose. That one also runs
 * inside checkout's transaction, and this one can fail: a store that already
 * holds two variants with one barcode cannot have the index, and must still be
 * able to sell. That refusal is logged rather than thrown, and
 * `assertVariantBarcodesAvailable` still guards every new write.
 */
export function ensureVariantBarcodeIndex() {
  variantBarcodeIndexPromise ??= createVariantBarcodeIndex().catch((error) => {
    variantBarcodeIndexPromise = null;

    throw error;
  });

  return variantBarcodeIndexPromise;
}

async function createVariantBarcodeIndex() {
  await ensureProductVariantSchema();

  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_barcode_unique"
         ON ${tableName("ProductVariant")} ("storeId", "barcode")
         WHERE "barcode" IS NOT NULL`
    );
  } catch (error) {
    if (!/could not create unique index|23505/i.test(String(error instanceof Error ? error.message : error))) {
      throw error;
    }

    console.error("[barcodes] variant barcodes are not unique yet, so their index was not created:", String(error).slice(0, 300));
  }
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

export type StoreVariantOption = {
  /** What the sale form's scanner matches, and what a variant's label carries. */
  barcode: string | null;
  continueSelling: boolean;
  id: string;
  imageUrl: string | null;
  /** Attribute name to value, e.g. `{ Color: "Black", Size: "M" }`, for a label's variant line. */
  options: Record<string, string>;
  price: string;
  productId: string;
  sku: string | null;
  stockQuantity: number;
  title: string;
};

/**
 * Every sellable variant in the store, in one query.
 *
 * The dashboard's manual order form has to offer options for whichever products
 * the seller picks, and it cannot know which those are before it renders — so
 * asking per product would mean one round trip per catalog row. Grouped by
 * product id on the caller's side.
 */
export async function getStoreVariantOptions(storeId: string) {
  await ensureProductVariantSchema();

  const rows = await prisma.$queryRawUnsafe<Array<Omit<StoreVariantOption, "options"> & { options: unknown }>>(
    `SELECT "id", "productId", "title", "sku", "barcode", "imageUrl", "options", "price", "stockQuantity", "continueSelling"
     FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "status" = 'ACTIVE'
     ORDER BY "productId" ASC, "position" ASC, "createdAt" ASC`,
    storeId
  );
  const byProductId = new Map<string, StoreVariantOption[]>();

  for (const row of rows) {
    const variant: StoreVariantOption = {
      barcode: row.barcode ?? null,
      continueSelling: Boolean(row.continueSelling),
      id: row.id,
      imageUrl: row.imageUrl ?? null,
      options: variantOptions(row.options),
      price: String(row.price),
      productId: row.productId,
      sku: row.sku ?? null,
      stockQuantity: Number(row.stockQuantity ?? 0),
      title: row.title
    };

    byProductId.set(variant.productId, [...(byProductId.get(variant.productId) ?? []), variant]);
  }

  return byProductId;
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

/**
 * Puts units back on a variant, for an order line that shrank or went away.
 *
 * The mirror of `decrementProductVariantStock`, and deliberately far less
 * fussy than it: giving stock back is always safe, so an option that has since
 * been deactivated or deleted is not an error here. It is simply a row that is
 * no longer there to credit, and refusing the seller's edit over it would
 * strand the order instead.
 */
export async function incrementProductVariantStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  variantId: string,
  quantity: number
) {
  await ensureProductVariantSchema(tx);

  if (quantity <= 0) {
    return;
  }

  await tx.$executeRawUnsafe(
    `UPDATE ${tableName("ProductVariant")}
     SET "stockQuantity" = "stockQuantity" + $4, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $3`,
    storeId,
    productId,
    variantId,
    quantity
  );
}

/**
 * The variant a line was sold from, found by SKU.
 *
 * Only for lines written before `OrderItem.variantId` existed. A null answer
 * is ambiguous rather than negative — it means "no variant claims this SKU",
 * which for a product that has options is exactly the case order editing
 * refuses to guess at.
 */
export async function findProductVariantIdBySku(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  sku: string
) {
  await ensureProductVariantSchema(tx);

  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "productId" = $2 AND "sku" = $3
     LIMIT 1`,
    storeId,
    productId,
    sku
  );

  return rows[0]?.id ?? null;
}

/**
 * Whether a product is sold by choosing one of its options. Only active ones
 * count: a product whose every option has been switched off is sold as the
 * product, as the dashboard's option list would suggest.
 *
 * This and the next two do no DDL: their caller has awaited
 * `ensureProductVariantSchema()` before opening the transaction it passes in.
 */
export async function productHasActiveVariants(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "productId" = $2 AND "status" = 'ACTIVE'
     LIMIT 1`,
    storeId,
    productId
  );

  return rows.length > 0;
}

/** The option a sale line names, re-read from the store's own rows; refused unless it is on sale. */
export async function getProductVariantForSale(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  variantId: string
) {
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
    throw new Error("One of the chosen product options is no longer for sale.");
  }

  return variant;
}

/**
 * Moves a variant's stock by `delta` — negative to sell, positive to give
 * back — and returns how many rows moved. A sale is refused in the statement
 * itself (0 rows) when it would take an option that does not keep selling
 * below zero, so two tills selling the last unit at once cannot both succeed.
 *
 * The DDL-free twin of the decrement and increment above, for a transaction
 * that ensured the schema before it opened: `CREATE INDEX IF NOT EXISTS` takes
 * a share lock on the table even when the index exists, and inside a
 * transaction that lock is held to the commit, queueing every other sale.
 */
export async function adjustProductVariantStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  variantId: string,
  delta: number
) {
  return tx.$executeRawUnsafe(
    `UPDATE ${tableName("ProductVariant")}
     SET "stockQuantity" = "stockQuantity" + $4, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $3
       AND ($4 >= 0 OR "continueSelling" OR "stockQuantity" + $4 >= 0)`,
    storeId,
    productId,
    variantId,
    delta
  );
}

/** A variant's stock on hand and its name, or null when the option no longer exists. */
export async function getProductVariantStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  variantId: string
) {
  const rows = await tx.$queryRawUnsafe<Array<{ stockQuantity: number; title: string }>>(
    `SELECT "stockQuantity", "title" FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $3
     LIMIT 1`,
    storeId,
    productId,
    variantId
  );
  const row = rows[0];

  return row ? { stockQuantity: Number(row.stockQuantity), title: row.title } : null;
}

/** Whether a product sells through options at all. */
export async function productHasVariants(
  tx: Prisma.TransactionClient,
  storeId: string,
  productId: string
) {
  await ensureProductVariantSchema(tx);

  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM ${tableName("ProductVariant")}
     WHERE "storeId" = $1 AND "productId" = $2
     LIMIT 1`,
    storeId,
    productId
  );

  return rows.length > 0;
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

function variantOptions(value: unknown): Record<string, string> {
  const parsed: unknown = typeof value === "string" ? safeJson(value) : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).flatMap(([name, option]) => (typeof option === "string" ? [[name, option]] : []))
  );
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
