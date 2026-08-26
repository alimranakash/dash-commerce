/**
 * What a cart's bundles are worth.
 *
 * Pure on purpose, and free of Prisma and Zod: the cart page, the checkout
 * summary and the order that follows all price the same cart, and the only way
 * those three cannot disagree is if they run the same function over the same
 * input. It is also the only part of this feature worth testing exhaustively,
 * which a pure function makes possible.
 */

export type BundlePricingLine = {
  lineId: string;
  price: string;
  productId: string;
  quantity: number;
};

export type BundlePricingRule = {
  /** QUANTITY only: how many units must be bought, and how many are then cut. */
  buyQuantity: number;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  getQuantity: number;
  id: string;
  /** For SET, `quantity` is what this product must contribute. QUANTITY ignores it. */
  items: Array<{ productId: string; quantity: number }>;
  name: string;
  type: "SET" | "QUANTITY";
};

export type AppliedBundle = {
  bundleId: string;
  description: string;
  discountAmount: string;
  name: string;
  timesApplied: number;
};

export type BundlePricingResult = {
  applied: AppliedBundle[];
  discountAmount: string;
};

/**
 * A single unit of a single product, at the price its line carries.
 *
 * Units rather than lines because both bundle shapes reason about units: a SET
 * takes two of one product and one of another, and a BOGO discounts the
 * cheapest of them. Lines cannot express either without arithmetic that is
 * wrong the moment a product appears twice at two prices.
 */
type CartUnit = {
  price: number;
  productId: string;
};

/**
 * A cart of fifty lines could hold thousands of units, and nothing here needs
 * to look at all of them to price a bundle. The cap keeps a mistyped quantity
 * from turning a checkout into a long loop.
 */
const MAX_UNITS = 500;

/** No cart should need more applications than this, and a rule bug must not spin. */
const MAX_APPLICATIONS = 100;

export function priceBundles(
  lines: BundlePricingLine[],
  rules: BundlePricingRule[]
): BundlePricingResult {
  const remaining = expandUnits(lines);
  const usable = rules.filter(isUsableRule);

  if (remaining.length === 0 || usable.length === 0) {
    return { applied: [], discountAmount: "0.00" };
  }

  const totals = new Map<string, AppliedBundle>();
  let discountTotal = 0;

  // One application per pass, best-value first. A shopper whose cart qualifies
  // for two bundles gets the better of them on the units they share, and the
  // other one on whatever is left — which is the only ordering that does not
  // need explaining to them.
  for (let pass = 0; pass < MAX_APPLICATIONS; pass += 1) {
    let best: { discount: number; rule: BundlePricingRule; unitIndexes: number[] } | null = null;

    for (const rule of usable) {
      const application = applyOnce(rule, remaining);

      if (application && (!best || application.discount > best.discount)) {
        best = { discount: application.discount, rule, unitIndexes: application.unitIndexes };
      }
    }

    if (!best || best.discount <= 0) {
      break;
    }

    // Consumed, so no unit is ever discounted by two bundles.
    for (const index of [...best.unitIndexes].sort((first, second) => second - first)) {
      remaining.splice(index, 1);
    }

    const rounded = round2(best.discount);
    const existing = totals.get(best.rule.id);

    discountTotal = round2(discountTotal + rounded);
    totals.set(best.rule.id, {
      bundleId: best.rule.id,
      description: best.rule.description,
      discountAmount: round2((existing ? Number(existing.discountAmount) : 0) + rounded).toFixed(2),
      name: best.rule.name,
      timesApplied: (existing?.timesApplied ?? 0) + 1
    });
  }

  return {
    applied: [...totals.values()],
    discountAmount: discountTotal.toFixed(2)
  };
}

/**
 * One application of one rule against the units still available, or null.
 *
 * Returns the indexes it would consume rather than consuming them, so the
 * caller can compare rules before committing to one.
 */
function applyOnce(rule: BundlePricingRule, units: CartUnit[]) {
  const cheapestFirst = units
    .map((unit, index) => ({ index, price: unit.price, productId: unit.productId }))
    .sort((first, second) => first.price - second.price);

  if (rule.type === "QUANTITY") {
    const memberIds = new Set(rule.items.map((item) => item.productId));
    const groupSize = rule.buyQuantity + rule.getQuantity;
    const group = cheapestFirst.filter((unit) => memberIds.has(unit.productId)).slice(0, groupSize);

    if (group.length < groupSize) {
      return null;
    }

    // The cheapest units of the group are the ones given away, which is the
    // convention every shopper already expects from "buy two get one free".
    const discounted = group.slice(0, rule.getQuantity);

    return {
      discount: discountFor(rule, discounted),
      unitIndexes: group.map((unit) => unit.index)
    };
  }

  const taken: Array<{ index: number; price: number }> = [];

  for (const item of rule.items) {
    const matches = cheapestFirst
      .filter((unit) => unit.productId === item.productId && !taken.some((entry) => entry.index === unit.index))
      .slice(0, item.quantity);

    if (matches.length < item.quantity) {
      return null;
    }

    taken.push(...matches.map((unit) => ({ index: unit.index, price: unit.price })));
  }

  return {
    discount: discountFor(rule, taken),
    unitIndexes: taken.map((entry) => entry.index)
  };
}

/**
 * What one application takes off.
 *
 * PERCENTAGE is a share of the units it applies to, so 100 makes them free.
 * FIXED is a flat amount — per discounted unit for a QUANTITY rule, per set for
 * a SET one — and neither may take more off than the units are worth, because
 * a bundle that pays the shopper is a bug in the seller's arithmetic, not an
 * offer.
 */
function discountFor(rule: BundlePricingRule, units: Array<{ price: number }>) {
  const value = units.reduce((total, unit) => total + unit.price, 0);

  if (value <= 0) {
    return 0;
  }

  if (rule.discountType === "PERCENTAGE") {
    const percentage = Math.min(100, Math.max(0, Number(rule.discountValue) || 0));

    return round2((value * percentage) / 100);
  }

  const flat = Math.max(0, Number(rule.discountValue) || 0);
  const requested = rule.type === "QUANTITY" ? flat * units.length : flat;

  return round2(Math.min(value, requested));
}

function expandUnits(lines: BundlePricingLine[]): CartUnit[] {
  const units: CartUnit[] = [];

  for (const line of lines) {
    const price = Number(line.price);
    const quantity = Math.floor(line.quantity);

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity < 1) {
      continue;
    }

    for (let index = 0; index < quantity && units.length < MAX_UNITS; index += 1) {
      units.push({ price, productId: line.productId });
    }
  }

  return units;
}

function isUsableRule(rule: BundlePricingRule) {
  if (rule.items.length === 0 || Number(rule.discountValue) <= 0) {
    return false;
  }

  if (rule.type === "QUANTITY") {
    return rule.buyQuantity >= 1 && rule.getQuantity >= 1;
  }

  return rule.items.every((item) => item.quantity >= 1);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
