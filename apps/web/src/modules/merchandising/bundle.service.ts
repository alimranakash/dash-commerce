import {
  priceBundles,
  type BundlePricingLine,
  type BundlePricingResult,
  type BundlePricingRule
} from "./bundle-pricing";
import {
  createOrderBundles,
  deleteBundleRecord,
  getBundleProductOptions,
  getBundleRecord,
  getLiveBundleRecords,
  getSellableBundleProductIds,
  listBundleRecords,
  saveBundleRecord,
  setBundleStatusRecord,
  type BundleRecord
} from "./bundle.repository";
import {
  bundleStatusSchema,
  describeBundle,
  saveBundleSchema,
  type BundleStatus,
  type SaveBundleInput
} from "./bundle.schema";

export { createOrderBundles };

/** A bundle as the dashboard lists and edits it. */
export type BundleSummary = {
  buyQuantity: number;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  expiresAt: Date | null;
  getQuantity: number;
  id: string;
  items: Array<{ price: string; productId: string; quantity: number; title: string }>;
  name: string;
  startsAt: Date | null;
  status: BundleStatus;
  type: "SET" | "QUANTITY";
};

export type BundleProductOption = {
  id: string;
  price: string;
  title: string;
};

export async function listBundles(storeId: string): Promise<BundleSummary[]> {
  const records = await listBundleRecords(storeId);

  return records.map(toBundleSummary);
}

export async function getBundle(storeId: string, bundleId: string): Promise<BundleSummary | null> {
  const record = await getBundleRecord(storeId, bundleId);

  return record ? toBundleSummary(record) : null;
}

export async function getBundleProducts(storeId: string): Promise<BundleProductOption[]> {
  const products = await getBundleProductOptions(storeId);

  return products.map((product) => ({
    id: product.id,
    price: product.price.toString(),
    title: product.title
  }));
}

/**
 * Creates or updates a bundle.
 *
 * Products the store does not own are dropped rather than rejected, the way the
 * rest of the catalogue treats a posted id it cannot place — but if that leaves
 * nothing, the save fails, because a bundle naming no products would sit in the
 * list looking active and never fire.
 */
export async function saveBundle(
  storeId: string,
  input: SaveBundleInput,
  bundleId?: string
): Promise<BundleSummary> {
  const data = saveBundleSchema.parse(input);

  if (bundleId && !(await getBundleRecord(storeId, bundleId))) {
    throw new Error("Bundle not found.");
  }

  const allowedIds = await getSellableBundleProductIds(
    storeId,
    data.items.map((item) => item.productId)
  );
  const seen = new Set<string>();
  const items = data.items.filter((item) => {
    if (!allowedIds.has(item.productId) || seen.has(item.productId)) {
      return false;
    }

    seen.add(item.productId);

    return true;
  });

  if (items.length === 0) {
    throw new Error("Pick at least one active product from this store.");
  }

  const saved = await saveBundleRecord({
    ...(bundleId ? { bundleId } : {}),
    data: {
      buyQuantity: data.type === "QUANTITY" ? data.buyQuantity : 0,
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      expiresAt: data.expiresAt,
      getQuantity: data.type === "QUANTITY" ? data.getQuantity : 0,
      name: data.name,
      startsAt: data.startsAt,
      status: data.status,
      type: data.type
    },
    items,
    storeId
  });

  const record = await getBundleRecord(storeId, saved.id);

  if (!record) {
    throw new Error("Bundle could not be read back after saving.");
  }

  return toBundleSummary(record);
}

export async function deleteBundle(storeId: string, bundleId: string) {
  if (!(await deleteBundleRecord(storeId, bundleId))) {
    throw new Error("Bundle not found.");
  }
}

export async function setBundleStatus(storeId: string, bundleId: string, status: unknown) {
  const parsed = bundleStatusSchema.parse(status);

  if (!(await setBundleStatusRecord(storeId, bundleId, parsed))) {
    throw new Error("Bundle not found.");
  }
}

/**
 * What this cart's bundles are worth right now.
 *
 * The single entry point for every surface that shows or charges a bundle
 * saving — the cart page, the checkout summary and the order itself all call
 * this, so none of them can quote a figure the others would not.
 */
export async function priceCartBundles(
  storeId: string,
  lines: BundlePricingLine[]
): Promise<BundlePricingResult> {
  if (lines.length === 0) {
    return { applied: [], discountAmount: "0.00" };
  }

  const records = await getLiveBundleRecords(storeId, new Date());

  return priceBundles(lines, records.map(toPricingRule));
}

function toPricingRule(record: BundleRecord): BundlePricingRule {
  return {
    buyQuantity: record.buyQuantity,
    description: bundleDescription(record),
    discountType: record.discountType,
    discountValue: record.discountValue.toString(),
    getQuantity: record.getQuantity,
    id: record.id,
    items: record.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    name: record.name,
    type: record.type
  };
}

function bundleDescription(record: BundleRecord) {
  return (
    record.description ||
    describeBundle({
      buyQuantity: record.buyQuantity,
      discountType: record.discountType,
      discountValue: record.discountValue.toString(),
      getQuantity: record.getQuantity,
      itemCount: record.items.length,
      type: record.type
    })
  );
}

function toBundleSummary(record: BundleRecord): BundleSummary {
  return {
    buyQuantity: record.buyQuantity,
    description: record.description,
    discountType: record.discountType,
    discountValue: record.discountValue.toString(),
    expiresAt: record.expiresAt,
    getQuantity: record.getQuantity,
    id: record.id,
    items: record.items.map((item) => ({
      price: item.product.price.toString(),
      productId: item.productId,
      quantity: item.quantity,
      title: item.product.title
    })),
    name: record.name,
    startsAt: record.startsAt,
    status: record.status,
    type: record.type
  };
}
