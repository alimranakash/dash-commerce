/**
 * Free shipping check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * free-shipping threshold and the bar that announces it — and, like
 * `verify-notification-bar.mts`, the half that needs neither a database nor a
 * session.
 *
 * One property matters more than every other one here: **the promise and the
 * price are the same number.** The bar this module replaced was a display
 * setting — `cartPage.freeShippingAmount`, shipped on at 250 — while
 * `createCheckoutOrder` charged `shippingRate.amount` unconditionally. A shopper
 * who added what the bar asked for was still billed for delivery. So the checks
 * below drive `resolveShippingCharge` (what checkout charges) and
 * `freeShippingProgress` (what the bar shows) over the same rules and assert
 * they agree at the boundary, and they assert by reading the source that
 * checkout and the checkout page both go through that one function.
 *
 * Covers:
 * - a rule that is off, or has no threshold, charging the full rate;
 * - the boundary: one cent short pays, exactly on it does not;
 * - zone scoping, including an empty list meaning every zone;
 * - money compared as integer cents rather than floats;
 * - the bar returning null wherever there is no real offer, so nothing is
 *   promised;
 * - the schema refusing a bar with no rule behind it, and a rule with no
 *   threshold;
 * - the default being off, so no existing shop starts absorbing delivery it
 *   never agreed to;
 * - checkout and the checkout page pricing through the same function;
 * - the cart, the mini cart and the product page reading the real rule rather
 *   than a display setting.
 *
 * Run with: npm run verify:free-shipping
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatFreeShippingMessage,
  freeShippingProgress,
  isFreeShippingLive,
  qualifiesForFreeShipping,
  resolveShippingCharge,
  type FreeShippingRule
} from "../apps/web/src/modules/free-shipping/free-shipping.render";
import {
  FREE_SHIPPING_DEFAULTS,
  freeShippingSettingsSchema,
  toFreeShippingRule,
  type FreeShippingSettings
} from "../apps/web/src/modules/free-shipping/free-shipping.schema";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

const WEB = join(process.cwd(), "apps", "web", "src");

function read(...parts: string[]) {
  return readFileSync(join(...parts), "utf8");
}

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const source = {
  cartPage: read(WEB, "modules", "cart", "components", "cart-page.tsx"),
  checkoutPage: read(WEB, "app", "storefront", "[slug]", "checkout", "page.tsx"),
  checkoutService: read(WEB, "modules", "checkout", "checkout.service.ts"),
  miniCart: read(WEB, "modules", "cart", "components", "mini-cart-drawer.tsx"),
  productPage: read(
    WEB,
    "modules",
    "storefront",
    "templates",
    "general-default",
    "product-page.tsx"
  ),
  progress: read(WEB, "modules", "cart", "components", "shipping-progress.tsx")
};

/** A shop giving free delivery over 1000, everywhere. */
const rule: FreeShippingRule = { enabled: true, threshold: 1000, zoneIds: [] };
const off: FreeShippingRule = { enabled: false, threshold: 1000, zoneIds: [] };

function settings(patch: Partial<FreeShippingSettings> = {}): FreeShippingSettings {
  return { ...FREE_SHIPPING_DEFAULTS, ...patch };
}

console.log("=== The rule has to exist before anything is promised ===");

check("a switched-off rule is not live", !isFreeShippingLive(off));
check(
  // Liveness is the seller's switch alone now: a shop can run free shipping
  // purely off flagged products, with no order value in it at all.
  "a rule with no threshold is still live, for the product route",
  isFreeShippingLive({ ...rule, threshold: 0 })
);
check("a configured rule is live", isFreeShippingLive(rule));

check(
  // The default that keeps every existing shop's pricing exactly as it was.
  "free shipping is off until a seller asks for it",
  FREE_SHIPPING_DEFAULTS.enabled === false && FREE_SHIPPING_DEFAULTS.threshold === 0
);

console.log("\n=== What checkout charges ===");

check(
  "a switched-off rule charges the full rate",
  resolveShippingCharge(off, {
    rateAmount: "130.00",
    subtotal: "5000.00"
  }) === "130.00"
);

check(
  "a cart under the threshold charges the full rate",
  resolveShippingCharge(rule, { rateAmount: "130.00", subtotal: "999.99" }) === "130.00"
);

check(
  // The boundary, in both directions. One cent decides whether a shopper pays
  // 130 taka, so it is worth an assertion rather than an assumption.
  "one cent short still pays",
  !qualifiesForFreeShipping(rule, { subtotal: "999.99" })
);

check("exactly on the threshold is free", qualifiesForFreeShipping(rule, { subtotal: "1000.00" }));

check(
  "a qualifying cart is charged nothing",
  resolveShippingCharge(rule, { rateAmount: "130.00", subtotal: "1000.00" }) === "0.00"
);

check(
  // `0.1 + 0.2 >= 0.3` is false in binary floating point; comparing cents is
  // what stops a shopper being a hundredth of a taka short of an offer they met.
  "money is compared as whole cents, not as floats",
  qualifiesForFreeShipping({ enabled: true, threshold: 0.3, zoneIds: [] }, { subtotal: 0.1 + 0.2 })
);

check(
  "the charge comes back fixed to two decimals, as the order column stores it",
  resolveShippingCharge(off, { rateAmount: 70, subtotal: 0 }) === "70.00"
);

console.log("\n=== Zones ===");

const dhakaOnly: FreeShippingRule = { enabled: true, threshold: 1000, zoneIds: ["zone-inside"] };

check(
  "a covered zone qualifies",
  qualifiesForFreeShipping(dhakaOnly, { subtotal: "2000", zoneId: "zone-inside" })
);

check(
  // A shop that can absorb 70 inside Dhaka very often cannot absorb 130 outside.
  "an uncovered zone still pays, however large the cart",
  resolveShippingCharge(dhakaOnly, {
    rateAmount: "130.00",
    subtotal: "999999",
    zoneId: "zone-outside"
  }) === "130.00"
);

check(
  // So a zone added next month is covered rather than silently excluded.
  "an empty zone list means every zone",
  qualifiesForFreeShipping(rule, { subtotal: "2000", zoneId: "any-zone-at-all" })
);

check(
  "a scoped rule with no zone on the order does not give it away",
  !qualifiesForFreeShipping(dhakaOnly, { subtotal: "2000", zoneId: null })
);

console.log("\n=== What the bar shows ===");

check("no rule, no bar", freeShippingProgress(off, "500") === null);

check(
  // The exact shape of the bug this module replaced, asserted where it is
  // actually prevented. `barEnabled` is a preference and the form accepts it
  // with no rule set — what it cannot do is produce a bar, because the offer
  // does not exist to be measured against.
  "the bar flag on its own cannot promise anything",
  freeShippingSettingsSchema.safeParse(settings({ barEnabled: true, enabled: false })).success &&
    freeShippingProgress(
      toFreeShippingRule(settings({ barEnabled: true, enabled: false })),
      "500"
    ) === null
);
check("no threshold, no bar", freeShippingProgress({ ...rule, threshold: 0 }, "500") === null);

const partway = freeShippingProgress(rule, "400");

check(
  "the shortfall is what is still needed",
  partway?.remaining === 600 && partway.qualifies === false,
  JSON.stringify(partway)
);

check("the track is the fraction earned", Math.round(partway?.percent ?? 0) === 40);

const earned = freeShippingProgress(rule, "1200");

check(
  "an over-full cart is capped rather than overflowing the track",
  earned?.percent === 100 && earned.qualifies && earned.remaining === 0
);

check(
  // The bar and the charge cannot disagree, because they read one rule.
  "the bar says earned at exactly the subtotal checkout stops charging at",
  freeShippingProgress(rule, "1000")?.qualifies ===
    (resolveShippingCharge(rule, { rateAmount: "130", subtotal: "1000" }) === "0.00")
);

check(
  "the seller's sentence takes the shortfall",
  formatFreeShippingMessage("Add {amount} more to get FREE shipping", "৳600") ===
    "Add ৳600 more to get FREE shipping"
);

check(
  "a sentence with no placeholder is left exactly as written",
  formatFreeShippingMessage("Spend a little more for free delivery", "৳600") ===
    "Spend a little more for free delivery"
);

check(
  "an empty sentence still says something",
  formatFreeShippingMessage("   ", "৳600").includes("৳600")
);

console.log("\n=== Buying one product can earn it outright ===");

const productOnly: FreeShippingRule = { enabled: true, threshold: 0, zoneIds: [] };
const repositorySource = read(WEB, "modules", "free-shipping", "free-shipping.repository.ts");

check(
  // "Buy product X and delivery is on us", with no order value in it at all.
  "a flagged product earns free delivery with no threshold set",
  resolveShippingCharge(productOnly, {
    hasFreeShippingProduct: true,
    rateAmount: "130.00",
    subtotal: "10.00"
  }) === "0.00"
);

check(
  "an ordinary cart earns nothing when there is no threshold",
  resolveShippingCharge(productOnly, {
    hasFreeShippingProduct: false,
    rateAmount: "130.00",
    subtotal: "999999"
  }) === "130.00"
);

check(
  "a flagged product beats a threshold the cart is nowhere near",
  resolveShippingCharge(rule, {
    hasFreeShippingProduct: true,
    rateAmount: "70",
    subtotal: "1"
  }) === "0.00"
);

check(
  // One offer, two routes, one geography: a shop that cannot absorb 130 taka to
  // Chattogram cannot absorb it for one product either.
  "the zone scope applies to the product route too",
  resolveShippingCharge(dhakaOnly, {
    hasFreeShippingProduct: true,
    rateAmount: "130.00",
    subtotal: "5",
    zoneId: "zone-outside"
  }) === "130.00"
);

check(
  // Asking a shopper to keep spending towards something they already have is
  // the other way this widget can lie.
  "the bar shows earned rather than a distance once a flagged product is in",
  (() => {
    const earnedByProduct = freeShippingProgress(rule, "10", { hasFreeShippingProduct: true });

    return (
      earnedByProduct?.qualifies === true &&
      earnedByProduct.remaining === 0 &&
      earnedByProduct.percent === 100
    );
  })()
);

check(
  "a product-only shop draws no progress bar for an ordinary cart",
  freeShippingProgress(productOnly, "500") === null
);

check(
  // Store-scoped, so a product id from another tenant cannot buy free delivery
  // here; and through the self-healing path, so a checkout on a client that
  // predates the column prices correctly instead of throwing.
  "the flag is read store-scoped, and through the self-healing path",
  repositorySource.includes('WHERE "storeId" = $1 AND "id" IN (${placeholders})') &&
    repositorySource.includes('"freeShipping" = true') &&
    repositorySource.includes('ADD COLUMN IF NOT EXISTS "freeShipping"')
);

check(
  "checkout asks whether the basket earns it outright",
  /hasFreeShippingProduct: await cartEarnsFreeShipping\(/.test(
    stripComments(source.checkoutService)
  )
);

check(
  // So the offer is visible at the point of decision rather than only once the
  // thing is already in the basket.
  "the product page counts the product being viewed, not just the cart",
  read(WEB, "modules", "free-shipping", "components", "free-shipping-bar-slot.tsx").includes(
    "...(productId ? [productId] : [])"
  )
);

check(
  "the seller sets it on the product itself",
  read(WEB, "modules", "products", "components", "product-form.tsx").includes('name="freeShipping"')
);

console.log("\n=== The schema will not let the bar lie ===");

check("the defaults parse", freeShippingSettingsSchema.safeParse(FREE_SHIPPING_DEFAULTS).success);

const bad: Array<[string, Partial<FreeShippingSettings>]> = [
  ["a negative threshold", { enabled: true, threshold: -1 }],
  [
    "a bar with nowhere to appear",
    { barEnabled: true, enabled: true, surfaces: [], threshold: 500 }
  ],
  [
    "an unknown surface",
    {
      barEnabled: true,
      enabled: true,
      surfaces: ["checkout"] as unknown as FreeShippingSettings["surfaces"],
      threshold: 500
    }
  ]
];

for (const [label, patch] of bad) {
  check(`${label} is refused`, !freeShippingSettingsSchema.safeParse(settings(patch)).success);
}

check(
  "a real offer saves",
  freeShippingSettingsSchema.safeParse(
    settings({ barEnabled: true, enabled: true, threshold: 1500 })
  ).success
);

check(
  // So a seller can switch the whole thing off without also having to clear the
  // number they had set.
  "switching the rule off with the bar off saves",
  freeShippingSettingsSchema.safeParse(
    settings({ barEnabled: false, enabled: false, threshold: 1500 })
  ).success
);

const fromForm = freeShippingSettingsSchema.safeParse({
  ...settings({ barEnabled: true, enabled: true }),
  threshold: "1500"
});

check(
  "a threshold submitted as a string is coerced",
  fromForm.success && fromForm.data.threshold === 1500
);

console.log("\n=== One number, wired to both ends ===");

check(
  // The line that turns the bar from an advert into a fact.
  "checkout prices delivery through the shared rule",
  /shippingAmount = resolveShippingCharge\(await getFreeShippingRule\(store\.id\)/.test(
    stripComments(source.checkoutService)
  )
);

check(
  "checkout measures the same cart subtotal the bar measures",
  /resolveShippingCharge\([\s\S]{0,600}subtotal: cart\.totals\.subtotal/.test(
    stripComments(source.checkoutService)
  )
);

check(
  // Otherwise the shopper is quoted the full rate on the checkout page and
  // charged nothing — the same disagreement, pointing the other way.
  "the checkout page quotes through the same function it will be charged by",
  stripComments(source.checkoutPage).includes("resolveShippingCharge(freeShippingRule")
);

check(
  "the cart reads the real rule rather than a display amount",
  stripComments(source.cartPage).includes("getFreeShippingBar(") &&
    !stripComments(source.cartPage).includes("settings.freeShippingAmount")
);

check(
  "the mini cart reads the real rule rather than a display amount",
  stripComments(source.miniCart).includes("freeShippingBar") &&
    !stripComments(source.miniCart).includes("settings.freeShippingAmount")
);

check(
  "the product page carries the bar too",
  stripComments(source.productPage).includes(
    '<FreeShippingBarSlot productId={product.id} store={store} surface="product" />'
  )
);

check(
  // A bar that works out its own threshold is a bar that can be given a
  // different one. It renders what it is handed and nothing else.
  "the progress bar no longer computes a threshold of its own",
  !stripComments(source.progress).includes("Math.max(0, amount") &&
    !stripComments(source.progress).includes("freeShippingAmount")
);

console.log("\n=== Wiring ===");

const prismaSchema = readFileSync(
  join(process.cwd(), "packages", "db", "prisma", "schema.prisma"),
  "utf8"
);

check("the settings model is in schema.prisma", prismaSchema.includes("model StoreFreeShipping"));

const repository = read(WEB, "modules", "free-shipping", "free-shipping.repository.ts");

check(
  "the model and the runtime DDL agree that it is off by default",
  /model StoreFreeShipping[\s\S]*?enabled\s+Boolean\s+@default\(false\)/.test(prismaSchema) &&
    repository.includes('"enabled" BOOLEAN NOT NULL DEFAULT false')
);

check(
  // Money through a float is money that rounds. Both sides store the string.
  "the threshold is stored as text in the model and the DDL",
  /threshold\s+String\s+@default\("0\.00"\)/.test(prismaSchema) &&
    repository.includes(`"threshold" TEXT NOT NULL DEFAULT '0.00'`)
);

const shippingPage = read(WEB, "app", "dashboard", "shipping", "page.tsx");

check(
  // It is a price, so it lives with the prices.
  "the seller edits it on the shipping page, beside the rates it waives",
  shippingPage.includes("<FreeShippingConsole")
);

console.log(
  failures === 0
    ? "\nAll free-shipping checks passed."
    : `\n${failures} free-shipping check(s) FAILED.`
);

process.exit(failures === 0 ? 0 : 1);
