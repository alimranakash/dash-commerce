import { prisma } from "@dash/db";
import { getDatabaseSchemaName } from "../fake-orders/fake-order-risk-schema";
import { ensureVariantBarcodeIndex } from "../products/product-variants.service";

/**
 * The only place that touches the database for barcodes and labels. Every
 * query is scoped by `storeId`.
 */

let ensurePromise: Promise<void> | null = null;

/**
 * Self-healing DDL for `Product.barcode` — see CLAUDE.md.
 *
 * The column is in schema.prisma and arrives with `db push`; it is repeated
 * here so a database nobody pushed still prints labels. The uniqueness is the
 * part that has to live here: a store's barcode must name one product, or a
 * scan rings up whichever row the lookup met first — and `db push` refuses to
 * add a unique constraint unattended, which is how `deploy/bin/release.sh` runs
 * it. A **partial** index is something Prisma cannot express, so its diff
 * leaves this one alone instead of dropping it, as with the checkout
 * submission key. Excluding nulls is also the honest rule: most products have
 * no barcode yet, and "none" cannot collide with another "none".
 *
 * `ALTER TABLE "Product"` locks the table, so this must never be awaited from
 * inside a transaction that has already touched `Product` — the deadlock
 * free shipping once shipped. Callers await it before opening theirs.
 */
export function ensureProductBarcodeSchema() {
  ensurePromise ??= addBarcodeColumn().catch((error) => {
    // A failed migration must not be cached as "done" — the next caller retries.
    ensurePromise = null;

    throw error;
  });

  return ensurePromise;
}

async function addBarcodeColumn() {
  const productTable = `"${getDatabaseSchemaName()}"."Product"`;

  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS "barcode" TEXT`
  );

  // Named so Prisma would never generate it, because it is ours to keep.
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Product_barcode_unique"
       ON ${productTable} ("storeId", "barcode")
       WHERE "barcode" IS NOT NULL`
  );

  // Its twin on the variants table, which that module owns.
  await ensureVariantBarcodeIndex();
}

function variantTable() {
  return `"${getDatabaseSchemaName()}"."ProductVariant"`;
}

/**
 * Everything a label is printed from. The trash is left out — an archived
 * product is not for sale — while drafts stay in, because a shop that sells
 * only at the counter keeps its catalogue off the storefront.
 */
export async function getLabelProductsForStore(storeId: string) {
  await ensureProductBarcodeSchema();

  return prisma.product.findMany({
    where: {
      status: { not: "ARCHIVED" },
      storeId
    },
    select: {
      barcode: true,
      id: true,
      images: {
        orderBy: { position: "asc" },
        select: { url: true },
        take: 1
      },
      price: true,
      sku: true,
      stockQuantity: true,
      title: true
    },
    orderBy: [{ title: "asc" }, { id: "asc" }]
  });
}

export async function getProductBarcodesForStore(storeId: string, productIds: string[]) {
  return prisma.product.findMany({
    where: {
      id: { in: productIds },
      storeId
    },
    select: {
      barcode: true,
      id: true
    }
  });
}

/**
 * Writes a barcode only onto a product that still has none, so two people
 * printing the same product at once cannot overwrite each other's — the second
 * write matches no row, and its caller re-reads the first.
 */
export async function setProductBarcodeIfMissing(storeId: string, productId: string, barcode: string) {
  const result = await prisma.product.updateMany({
    where: {
      barcode: null,
      id: productId,
      storeId
    },
    data: {
      barcode
    }
  });

  return result.count;
}

/**
 * The active variants of products a label can be printed for, the same set the
 * sale form can sell: an inactive option is not for sale, and a product in the
 * trash takes its options with it.
 */
export async function getVariantBarcodesForStore(storeId: string, variantIds: string[]) {
  if (!variantIds.length) {
    return [];
  }

  const placeholders = variantIds.map((_, index) => `$${index + 2}`).join(", ");

  return prisma.$queryRawUnsafe<Array<{ barcode: string | null; id: string; productId: string }>>(
    `SELECT v."id", v."productId", v."barcode"
     FROM ${variantTable()} v JOIN "${getDatabaseSchemaName()}"."Product" p ON p."id" = v."productId"
     WHERE v."storeId" = $1 AND v."status" = 'ACTIVE' AND p."status" <> 'ARCHIVED' AND v."id" IN (${placeholders})`,
    storeId,
    ...variantIds
  );
}

/** As `setProductBarcodeIfMissing`, for one option of a product. */
export async function setVariantBarcodeIfMissing(storeId: string, variantId: string, barcode: string) {
  return prisma.$executeRawUnsafe(
    `UPDATE ${variantTable()} SET "barcode" = $3, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "storeId" = $1 AND "id" = $2 AND "barcode" IS NULL`,
    storeId,
    variantId,
    barcode
  );
}

/**
 * Whether a code is free in this store, across both tables a scan looks in:
 * one code names one product or one variant, never two things. `except` is the
 * row being saved, which may of course keep its own code.
 */
export async function isBarcodeAvailable(
  storeId: string,
  barcode: string,
  except: { productId?: string | undefined; variantId?: string | undefined } = {}
) {
  const product = await prisma.product.findFirst({
    where: {
      barcode,
      storeId,
      ...(except.productId ? { id: { not: except.productId } } : {})
    },
    select: {
      id: true
    }
  });

  if (product) {
    return false;
  }

  const variants = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM ${variantTable()}
     WHERE "storeId" = $1 AND upper("barcode") = $2${except.variantId ? ` AND "id" <> $3` : ""}
     LIMIT 1`,
    storeId,
    barcode,
    ...(except.variantId ? [except.variantId] : [])
  );

  return variants.length === 0;
}
