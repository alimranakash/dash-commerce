import { randomInt } from "node:crypto";
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import {
  ensureProductBarcodeSchema,
  getLabelProductsForStore,
  getProductBarcodesForStore,
  getVariantBarcodesForStore,
  isBarcodeAvailable,
  setProductBarcodeIfMissing,
  setVariantBarcodeIfMissing
} from "./barcode.repository";
import { assignBarcodesSchema } from "./barcode.schema";
import { generateInStoreEan13 } from "./barcode.symbology";

export { ensureProductBarcodeSchema, getLabelProductsForStore };

/**
 * A barcode exists for one reason — so a scan at the till names this product,
 * or this one size and colour of it — and a thing with no barcode cannot be
 * scanned. So printing a label for one is what gives it a code: an in-store
 * EAN-13, written to the product or variant before the label is drawn, so the
 * number on the sticker is already the number the sale form looks up. Anything
 * that already has one keeps it; nothing here ever replaces a barcode, least of
 * all a manufacturer's.
 *
 * Returns every requested product and variant of this store with its barcode.
 * Ids from another store — or an option switched off since the page loaded —
 * are simply absent: the store is the session's, never the browser's.
 */
export async function assignMissingBarcodes(
  storeId: string,
  request: { productIds?: string[] | undefined; variantIds?: string[] | undefined }
) {
  const parsed = assignBarcodesSchema.parse({
    productIds: request.productIds ?? [],
    variantIds: request.variantIds ?? []
  });

  // Before any write, and outside any transaction — see ensureProductBarcodeSchema.
  await ensureProductBarcodeSchema();

  const products = await getProductBarcodesForStore(storeId, Array.from(new Set(parsed.productIds)));
  const variants = await getVariantBarcodesForStore(storeId, Array.from(new Set(parsed.variantIds)));
  const productBarcodes: Record<string, string> = {};
  const variantBarcodes: Record<string, string> = {};
  let assigned = 0;

  for (const product of products) {
    if (product.barcode) {
      productBarcodes[product.id] = product.barcode;
      continue;
    }

    productBarcodes[product.id] = await assignBarcode(storeId, { id: product.id, kind: "product" });
    assigned += 1;
  }

  for (const variant of variants) {
    if (variant.barcode) {
      variantBarcodes[variant.id] = variant.barcode;
      continue;
    }

    variantBarcodes[variant.id] = await assignBarcode(storeId, { id: variant.id, kind: "variant" });
    assigned += 1;
  }

  return { assigned, productBarcodes, variantBarcodes };
}

/**
 * The product form's uniqueness rule, said the way the SKU rule is — across
 * variants too, since a scan looks in both. The partial indexes still have the
 * last word on a race between two saves.
 */
export async function assertProductBarcodeAvailable(
  storeId: string,
  barcode: string,
  ignoreProductId?: string
) {
  await ensureProductBarcodeSchema();

  if (!(await isBarcodeAvailable(storeId, barcode, { productId: ignoreProductId }))) {
    throw new Error("Another product or variant already has this barcode.");
  }
}

const ASSIGN_ATTEMPTS = 5;

type BarcodeTarget = { id: string; kind: "product" | "variant" };

/**
 * Ten random digits under the in-store prefix: a collision within one store is
 * a one-in-ten-billion event per existing code. Each table's unique index turns
 * a collision inside it into a retry, and the availability check turns one
 * across the two into a retry as well — rather than two things on one sticker.
 */
async function assignBarcode(storeId: string, target: BarcodeTarget) {
  for (let attempt = 0; attempt < ASSIGN_ATTEMPTS; attempt += 1) {
    const candidate = generateInStoreEan13(() => randomInt(10));

    if (!(await isBarcodeAvailable(storeId, candidate))) {
      continue;
    }

    try {
      const written =
        target.kind === "variant"
          ? await setVariantBarcodeIfMissing(storeId, target.id, candidate)
          : await setProductBarcodeIfMissing(storeId, target.id, candidate);

      if (written === 1) {
        return candidate;
      }
    } catch (error) {
      if (isUniqueConstraintError(error, "barcode") || isRawUniqueViolation(error)) {
        continue;
      }

      throw error;
    }

    // Matched no row: someone gave it a barcode between the read and this
    // write. Theirs is already on a label, so it is the one to print.
    const [current] =
      target.kind === "variant"
        ? await getVariantBarcodesForStore(storeId, [target.id])
        : await getProductBarcodesForStore(storeId, [target.id]);

    if (current?.barcode) {
      return current.barcode;
    }

    throw new Error("That product or option is no longer for sale in this store.");
  }

  throw new Error("A unique barcode could not be assigned. Try printing again.");
}

/**
 * A raw statement's unique violation arrives as P2010 rather than P2002 —
 * Prisma does not map errors from SQL it did not write — with the driver's
 * own classification underneath.
 */
function isRawUniqueViolation(error: unknown) {
  const cause = (error as { meta?: { driverAdapterError?: { cause?: { kind?: unknown } } } } | null)?.meta
    ?.driverAdapterError?.cause;

  return cause?.kind === "UniqueConstraintViolation" || /23505|unique constraint/i.test(String(error));
}
