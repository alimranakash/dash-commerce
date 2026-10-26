import { normalizeBarcodeValue } from "../barcodes/barcode.schema";
import {
  buildScanIndex,
  resolveSaleScan,
  saleScanTargets,
  type SaleScanTarget,
  type ScanIndex
} from "../barcodes/barcode.scan";

/**
 * The till's half of a scan: a code and the sale's lines in, the lines with
 * that product rung up — or the same lines and the reason — out.
 *
 * Every scan goes through `ringUpScan`, from the scan box and from the page's
 * scanner listener alike, and it touches nothing but the lines: the customer,
 * the payment and the notes are not its to change. Nothing here saves a sale
 * either — the server re-reads every product, option and stock level when the
 * Save button posts, so the catalogue the page was rendered with only decides
 * what a scan *offers*. Pure, so `verify-sale-scanner` can ring up whole
 * baskets without a browser.
 */

export type SaleVariantOption = {
  barcode?: string | null;
  /** May sell past zero — the rule the server's stock decrement applies. */
  continueSelling: boolean;
  id: string;
  price: string;
  sku?: string | null;
  stockQuantity: number;
  title: string;
};

export type SaleProductOption = {
  /** In the trash: listed, so an old sale's line still shows, but a scan will not sell it. */
  archived?: boolean;
  /** What a label's barcode scans to — see modules/barcodes/. */
  barcode?: string | null;
  id: string;
  price: string;
  sku?: string | null;
  stockQuantity: number;
  title: string;
  /** Its active options; a product with any is sold as one of them, at its price and from its stock. */
  variants?: SaleVariantOption[];
};

export type SaleLine = {
  discount: string;
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  /** Blank for a product without options, or one whose option is still to be chosen. */
  variantId: string;
};

export type SaleScanFeedback = {
  /** The line the scan added to or opened, for the form to point at. */
  lineId?: string | undefined;
  message: string;
  tone: "error" | "ok" | "warn";
};

export type SaleScanCatalogue = {
  currency: string;
  /** Units the sale being edited already took from stock, by `lineKey` — see `stockHeldBySale`. */
  held: ReadonlyMap<string, number>;
  index: ScanIndex<SaleScanTarget>;
  products: ReadonlyMap<string, SaleProductOption>;
};

export function emptySaleLine(id: string): SaleLine {
  return {
    discount: "0.00",
    id,
    productId: "",
    quantity: 1,
    unitPrice: "0.00",
    variantId: ""
  };
}

/** `productId::variantId`, the key a scan target and a line share. */
export function lineKey(productId: string, variantId: string) {
  return `${productId}::${variantId}`;
}

export function buildSaleScanCatalogue(
  products: readonly SaleProductOption[],
  currency: string,
  held: ReadonlyMap<string, number> = new Map()
): SaleScanCatalogue {
  return {
    currency,
    held,
    index: buildScanIndex(saleScanTargets(products)),
    products: new Map(products.map((product) => [product.id, product]))
  };
}

/**
 * What a completed sale being edited already took off the shelf. Saving puts
 * those units back before taking the new quantities, so they are this sale's
 * to sell again; a draft took nothing.
 */
export function stockHeldBySale(sale?: { items?: readonly SaleLine[] | undefined; status?: string | undefined }) {
  const held = new Map<string, number>();

  if (sale?.status !== "COMPLETED") {
    return held;
  }

  for (const item of sale.items ?? []) {
    const key = lineKey(item.productId, item.variantId);

    held.set(key, (held.get(key) ?? 0) + item.quantity);
  }

  return held;
}

/**
 * A scanned code becomes a line, the way a till rings it up: the same item
 * again adds one to its line rather than a second line, and a fresh one fills
 * the empty row the form opens with before adding another. A variant's code
 * names the exact size or colour, at that option's own price and against its
 * own stock — exactly as picking it from the lists would.
 *
 * Stock is the rule completing the sale enforces: a product's own count, or an
 * option's unless it keeps selling past zero, measured over every line of the
 * item rather than the one being added to. A scan that would go past it is
 * refused rather than rung up with a warning — the cashier hears it at the
 * moment the item is in their hand, not at Save. Typing a quantity on the line
 * still works, for a draft that does not take stock.
 */
export function ringUpScan(
  lines: SaleLine[],
  catalogue: SaleScanCatalogue,
  raw: string,
  newLineId: () => string
): { feedback: SaleScanFeedback; lines: SaleLine[] } {
  const code = normalizeBarcodeValue(raw);
  const refuse = (message: string) => ({ feedback: { message, tone: "error" as const }, lines });
  const unknown = `No product has the barcode or SKU "${code}". Check the label, or choose it from the list.`;
  const resolution = resolveSaleScan(catalogue.index, code);

  if (resolution.kind === "none") {
    return refuse(unknown);
  }

  if (resolution.kind === "ambiguous") {
    const names = resolution.productIds.map((id) => catalogue.products.get(id)?.title ?? id);

    return refuse(
      `"${code}" is on more than one product (${names.join(", ")}). Choose the right one from the list, and give each its own barcode.`
    );
  }

  if (resolution.kind === "archived") {
    const title = catalogue.products.get(resolution.productId)?.title ?? "This product";

    return refuse(`${title} is in the trash. Restore it in Products to sell it.`);
  }

  const { target } = resolution;
  const product = catalogue.products.get(target.productId);
  const variant = target.variantId ? product?.variants?.find((entry) => entry.id === target.variantId) : undefined;

  if (!product || (target.variantId && !variant)) {
    return refuse(unknown);
  }

  const variantId = variant?.id ?? "";
  const name = variant ? `${product.title} - ${variant.title}` : product.title;
  const sameItem = (line: SaleLine) => line.productId === product.id && line.variantId === variantId;

  if (!target.needsVariant && !variant?.continueSelling) {
    const onSale = lines.filter(sameItem).reduce((total, line) => total + line.quantity, 0);
    const available =
      (variant ? variant.stockQuantity : product.stockQuantity) + (catalogue.held.get(lineKey(product.id, variantId)) ?? 0);

    if (onSale + 1 > available) {
      return refuse(
        available > 0
          ? `Only ${available} of ${name} in stock, and ${onSale} already on this sale.`
          : `${name} is out of stock.`
      );
    }
  }

  const existing = lines.find(sameItem);
  const pending = {
    message: `${product.title} comes in options — choose which one on its line.`,
    tone: "warn" as const
  };

  if (existing) {
    const quantity = existing.quantity + 1;

    return {
      feedback: target.needsVariant
        ? { ...pending, lineId: existing.id }
        : { lineId: existing.id, message: `${name} — qty ${quantity}`, tone: "ok" },
      lines: lines.map((line) => (line.id === existing.id ? { ...line, quantity } : line))
    };
  }

  const blank = lines.find((line) => !line.productId);
  const unitPrice = variant?.price ?? product.price;
  const line = {
    ...(blank ?? emptySaleLine(newLineId())),
    productId: product.id,
    quantity: 1,
    unitPrice,
    variantId
  };

  return {
    feedback: target.needsVariant
      ? { ...pending, lineId: line.id }
      : {
          lineId: line.id,
          message: `${name} added — ${formatSaleMoney(Number(unitPrice) || 0, catalogue.currency)}`,
          tone: "ok"
        },
    lines: blank ? lines.map((entry) => (entry.id === blank.id ? line : entry)) : [...lines, line]
  };
}

export function formatSaleMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
