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

/** Every row a code names, in catalogue order — more than one is a conflict the caller decides. */
export type ScanIndex<T extends ScannableProduct> = {
  byBarcode: ReadonlyMap<string, readonly T[]>;
  bySku: ReadonlyMap<string, readonly T[]>;
};

export type SaleScanProduct = {
  /** In the trash: still recognised at the till, so the cashier is told why it will not ring up. */
  archived?: boolean | undefined;
  barcode?: string | null | undefined;
  id: string;
  sku?: string | null | undefined;
  /** The active options, for a product sold by size, colour and the like. */
  variants?: ReadonlyArray<{ barcode?: string | null | undefined; id: string; sku?: string | null | undefined }> | undefined;
};

export type SaleScanTarget = {
  archived: boolean;
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
      archived: product.archived === true,
      barcode: variant.barcode ?? null,
      id: `${product.id}::${variant.id}`,
      needsVariant: false,
      productId: product.id,
      sku: variant.sku ?? null,
      variantId: variant.id
    }))
  );
  const wholeProducts = products.map((product) => ({
    archived: product.archived === true,
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
  const byBarcode = new Map<string, T[]>();
  const bySku = new Map<string, T[]>();

  for (const product of products) {
    const barcode = normalizeBarcodeValue(product.barcode ?? "");
    const sku = normalizeBarcodeValue(product.sku ?? "");

    if (barcode) {
      byBarcode.set(barcode, [...(byBarcode.get(barcode) ?? []), product]);
    }

    if (sku) {
      bySku.set(sku, [...(bySku.get(sku) ?? []), product]);
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
  return matchScan(index, raw)[0] ?? null;
}

/**
 * Every row a scanned code names, from the first pass that names any — all of
 * its barcodes, or failing those all of its SKUs. `lookupScan` takes the first;
 * the till wants them all, because two rows behind one code is a label it must
 * not guess at.
 */
export function matchScan<T extends ScannableProduct>(index: ScanIndex<T>, raw: string): T[] {
  const code = normalizeBarcodeValue(raw);

  if (!code) {
    return [];
  }

  const candidates = scanCandidates(code);

  for (const pass of [index.byBarcode, index.bySku]) {
    const matches = [...new Set(candidates.flatMap((candidate) => pass.get(candidate) ?? []))];

    if (matches.length) {
      return matches;
    }
  }

  return [];
}

export type SaleScanResolution =
  | { kind: "ambiguous"; productIds: string[] }
  | { kind: "archived"; productId: string }
  | { kind: "found"; target: SaleScanTarget }
  | { kind: "none" };

/**
 * What a code rings up at the till, or why it rings up nothing.
 *
 * The save paths keep a barcode to one row, but a store can still hold two —
 * rows from before the unique index, a variant index that existing duplicates
 * refused, or a UPC-A on one product and its leading-zero EAN-13 on another.
 * Taking whichever the index met first would sell the wrong product at the
 * wrong price with nothing on screen to say so, so a code naming two products
 * is refused. Within one product it is still certain which product was
 * scanned: a single option beats the product's own row, as before, and several
 * options sharing a code open the line waiting for the cashier to choose.
 *
 * A product in the trash is not for sale, but it is not unknown either — the
 * cashier is told where it went. When a live product shares the code, the live
 * one is what is in the customer's hand.
 */
export function resolveSaleScan(index: ScanIndex<SaleScanTarget>, raw: string): SaleScanResolution {
  const matches = matchScan(index, raw);
  const live = matches.filter((target) => !target.archived);
  const first = matches[0];

  if (!first) {
    return { kind: "none" };
  }

  if (!live.length) {
    return { kind: "archived", productId: first.productId };
  }

  const productIds = [...new Set(live.map((target) => target.productId))];
  const productId = productIds[0];

  if (productIds.length > 1 || !productId) {
    return { kind: "ambiguous", productIds };
  }

  const options = live.filter((target) => target.variantId);
  const option = options[0];

  if (options.length === 1 && option) {
    return { kind: "found", target: option };
  }

  const whole = live.find((target) => !target.variantId);

  if (!options.length && whole) {
    return { kind: "found", target: whole };
  }

  return {
    kind: "found",
    target: {
      archived: false,
      barcode: null,
      id: `${productId}::`,
      needsVariant: true,
      productId,
      sku: null,
      variantId: null
    }
  };
}

/**
 * A USB or Bluetooth scanner is a keyboard: it types the code and presses
 * Enter, a few milliseconds a key. A person cannot keep that up, which is the
 * whole test — at least `WEDGE_MIN_LENGTH` characters each closer than
 * `WEDGE_MAX_GAP_MS` to the last, then Enter just as fast. A fast typist rolls
 * the odd pair of keys inside 50 ms; four in a row and an Enter, never.
 *
 * Enter is what nearly every scanner sends after a code, and Tab is the other
 * suffix their setup sheets offer, so either ends a scan.
 *
 * The sale form's scan box takes a code itself, at any speed. This is for the
 * rest of the page: a scan that lands on a button, or in a quantity box the
 * cashier forgot was focused, is still a scan.
 */
export const WEDGE_MAX_GAP_MS = 50;
export const WEDGE_MIN_LENGTH = 4;

export type WedgeState = { buffer: string; lastAt: number };

export const EMPTY_WEDGE: WedgeState = { buffer: "", lastAt: 0 };

export function isScanSuffix(key: string) {
  return key === "Enter" || key === "Tab";
}

export function feedWedgeKey(
  state: WedgeState,
  key: string,
  at: number
): { scanned: string | null; state: WedgeState } {
  const fresh = at - state.lastAt <= WEDGE_MAX_GAP_MS;

  if (isScanSuffix(key)) {
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
