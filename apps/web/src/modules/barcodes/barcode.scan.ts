import { normalizeBarcodeValue } from "./barcode.schema";

/**
 * What happens when a code reaches the till: which product it names, and how
 * to tell a scanner's keystrokes from a person's.
 *
 * Pure, so the sale form can match on every keystroke without a round trip —
 * the page already holds the store's catalogue — and so `verify-barcodes` can
 * drive both halves without a browser.
 */

export type ScannableProduct = {
  barcode?: string | null | undefined;
  id: string;
  sku?: string | null | undefined;
};

export type ScanIndex<T extends ScannableProduct> = {
  byBarcode: ReadonlyMap<string, T>;
  bySku: ReadonlyMap<string, T>;
};

export type SaleScanProduct = {
  barcode?: string | null | undefined;
  id: string;
  sku?: string | null | undefined;
  /** The active options, for a product sold by size, colour and the like. */
  variants?: ReadonlyArray<{ barcode?: string | null | undefined; id: string; sku?: string | null | undefined }> | undefined;
};

export type SaleScanTarget = {
  barcode: string | null;
  /** `productId::variantId`, the same key a sale line is matched on. */
  id: string;
  /**
   * The product's own code was scanned, but it is sold by option — a scan
   * cannot say which size, so the cashier still has to.
   */
  needsVariant: boolean;
  productId: string;
  sku: string | null;
  variantId: string | null;
};

/**
 * Everything a scan at the till can name: each variant on its own, and each
 * product as a whole. Variants come first, so where a code or an SKU is shared
 * — the save paths refuse a shared barcode, but SKUs are only unique per table
 * — the exact option is the one rung up.
 */
export function saleScanTargets(products: readonly SaleScanProduct[]): SaleScanTarget[] {
  const variants = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      barcode: variant.barcode ?? null,
      id: `${product.id}::${variant.id}`,
      needsVariant: false,
      productId: product.id,
      sku: variant.sku ?? null,
      variantId: variant.id
    }))
  );
  const wholeProducts = products.map((product) => ({
    barcode: product.barcode ?? null,
    id: `${product.id}::`,
    needsVariant: Boolean(product.variants?.length),
    productId: product.id,
    sku: product.sku ?? null,
    variantId: null
  }));

  return [...variants, ...wholeProducts];
}

export function buildScanIndex<T extends ScannableProduct>(products: readonly T[]): ScanIndex<T> {
  const byBarcode = new Map<string, T>();
  const bySku = new Map<string, T>();

  for (const product of products) {
    const barcode = normalizeBarcodeValue(product.barcode ?? "");
    const sku = normalizeBarcodeValue(product.sku ?? "");

    if (barcode && !byBarcode.has(barcode)) {
      byBarcode.set(barcode, product);
    }

    if (sku && !bySku.has(sku)) {
      bySku.set(sku, product);
    }
  }

  return { byBarcode, bySku };
}

/**
 * The spellings one physical barcode can arrive in. A UPC-A is an EAN-13 with
 * a leading zero, and whether the scanner sends twelve digits or thirteen is a
 * setting on the scanner — so a box whose code was typed in one form still
 * rings up when the till's scanner reports the other.
 */
export function scanCandidates(code: string) {
  if (/^\d{12}$/.test(code)) {
    return [code, `0${code}`];
  }

  if (/^0\d{12}$/.test(code)) {
    return [code, code.slice(1)];
  }

  return [code];
}

/**
 * The product a scanned code names, or null.
 *
 * A barcode beats an SKU: the barcode is the field that exists for this, and a
 * shop whose old labels were printed from SKUs still rings up through the
 * second pass. Every spelling is tried as a barcode before any as an SKU, so
 * one product's SKU can never shadow another's barcode.
 */
export function lookupScan<T extends ScannableProduct>(index: ScanIndex<T>, raw: string): T | null {
  const code = normalizeBarcodeValue(raw);

  if (!code) {
    return null;
  }

  const candidates = scanCandidates(code);

  for (const candidate of candidates) {
    const product = index.byBarcode.get(candidate);

    if (product) {
      return product;
    }
  }

  for (const candidate of candidates) {
    const product = index.bySku.get(candidate);

    if (product) {
      return product;
    }
  }

  return null;
}

/**
 * A USB or Bluetooth scanner is a keyboard: it types the code and presses
 * Enter, a few milliseconds a key. A person cannot keep that up, which is the
 * whole test — at least `WEDGE_MIN_LENGTH` characters each closer than
 * `WEDGE_MAX_GAP_MS` to the last, then Enter just as fast. A fast typist rolls
 * the odd pair of keys inside 50 ms; four in a row and an Enter, never.
 *
 * The sale form's scan box takes a code itself, at any speed. This is for the
 * rest of the page: a scan that lands on a button, or in a quantity box the
 * cashier forgot was focused, is still a scan.
 */
export const WEDGE_MAX_GAP_MS = 50;
export const WEDGE_MIN_LENGTH = 4;

export type WedgeState = { buffer: string; lastAt: number };

export const EMPTY_WEDGE: WedgeState = { buffer: "", lastAt: 0 };

export function feedWedgeKey(
  state: WedgeState,
  key: string,
  at: number
): { scanned: string | null; state: WedgeState } {
  const fresh = at - state.lastAt <= WEDGE_MAX_GAP_MS;

  if (key === "Enter") {
    const scanned = fresh && state.buffer.length >= WEDGE_MIN_LENGTH ? state.buffer : null;

    return { scanned, state: EMPTY_WEDGE };
  }

  if (key.length !== 1) {
    // Shift arrives before every capital a scanner types; it is not a gap.
    return { scanned: null, state: key === "Shift" ? state : EMPTY_WEDGE };
  }

  return {
    scanned: null,
    state: { buffer: fresh ? state.buffer + key : key, lastAt: at }
  };
}
