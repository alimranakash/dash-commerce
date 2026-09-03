/**
 * Quick View check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * product card's Quick View — the same shape as `verify-direct-checkout.mts`,
 * and deliberately the half that needs neither a database nor a request.
 *
 * The feature is one sentence: **look at a product without leaving the grid.**
 * Everything below is that sentence made checkable, and the two halves it splits
 * into are the two ways this feature goes wrong silently.
 *
 * The first is the **modal quoting the card**. A card is a snapshot taken when
 * the page rendered; the modal is a buy box. A grid left open in a tab, a price
 * edited, a product unpublished — and a dialog built from card props would
 * cheerfully sell a shopper something at a number nobody stands behind. So the
 * reads are asserted to go through the resolver's own `getStorefrontProductBySlug`,
 * the payload is asserted to be built by one named-field function, and both the
 * route and the service are asserted to take slugs and never a `storeId`.
 *
 * The second is the **seller's switch not meaning off**. A trigger hidden in CSS
 * is still in the tab order and still in the page source, and a modal that
 * trusts the page that opened it will happily serve a shop that switched Quick
 * View off an hour ago. Both are checked, the first as a `return null` and the
 * second as a re-read in the service.
 *
 * The pure half — the summary, the savings badge, the quantity cap, the view
 * itself — is driven for real, because that is where the small lies live: a
 * description cut mid-word, an ellipsis promising more where there is none, a
 * "0% off" badge, a discount computed over binary floats.
 *
 * Covers:
 * - Quick View defaulting **on**, unlike the widgets that publish something, and
 *   a blank button label falling back rather than shipping a nameless button;
 * - the description length clamped, and the trigger style a closed enum;
 * - the view being null when the switch is off, and the buy box being borrowed
 *   from Product Page rather than copied — except Direct Checkout, which is
 *   Quick View's own;
 * - a summary that strips markup, decodes entities, collapses whitespace, stops
 *   on a whole word, and adds no ellipsis to text that already fits;
 * - the seller's short description winning over the long one;
 * - savings compared in whole cents, rounded down, and absent rather than zero;
 * - the payload carrying exactly the fields named — no cost price, no supplier,
 *   no demo-pack id — and dropping inactive variants;
 * - the store resolved from the slug, the product re-read through
 *   `publicProductWhere`, and neither taking an id from the browser;
 * - the seller's switch re-checked on the server rather than trusted;
 * - the trigger rendering nothing at all when Quick View is off;
 * - the dialog reusing the product page's own buy box rather than posting to
 *   `/api/cart` itself, and portalling into the shop's theme scope.
 *
 * Run with: npm run verify:quick-view
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings
} from "../apps/web/src/modules/storefront/customization";
import {
  activeQuickViewVariants,
  buildQuickViewProduct,
  buildQuickViewView,
  quickViewMaxQuantity,
  quickViewSavings,
  quickViewSummary
} from "../apps/web/src/modules/quick-view/quick-view.render";

const WEB_DIR = join(process.cwd(), "apps", "web", "src");

const source = {
  card: read("modules", "storefront", "components", "product-listing.tsx"),
  layout: read("app", "storefront", "[slug]", "layout.tsx"),
  modal: read("modules", "quick-view", "components", "quick-view-modal.tsx"),
  provider: read("modules", "quick-view", "components", "quick-view-provider.tsx"),
  route: read("app", "api", "storefront", "quick-view", "route.ts"),
  service: read("modules", "quick-view", "quick-view.service.ts"),
  trigger: read("modules", "quick-view", "components", "quick-view-trigger.tsx")
};

/** A catalogue row, so only the field under test varies. */
const PRODUCT = {
  allowPreorder: false,
  category: { name: "Outerwear" },
  compareAtPrice: "2400.00",
  description: "A quilted jacket, cut for Dhaka winters.",
  id: "prod_1",
  images: [{ alt: null, url: "/uploads/a.jpg" }],
  preorderReleaseAt: null,
  price: "1800.00",
  shortDescription: null,
  sku: "JKT-01",
  slug: "quilted-jacket",
  stockQuantity: 7,
  title: "Quilted Jacket"
} as const;

let failures = 0;

function read(...parts: string[]) {
  return readFileSync(join(WEB_DIR, ...parts), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks that assert a name is *absent* have to read the code: the doc
 * comments here name `storeId` and `document.body` while explaining the rules
 * about them, and scanning the raw file would fail on its own explanation — the
 * worst kind of check, because it punishes the comment that makes the guarantee
 * legible.
 */
function code(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function settingsWith(quickView: Record<string, unknown>) {
  return normalizeAdvancedSettings({ quickView });
}

console.log("=== The seller's switch ===");

const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.quickView;

check(
  "Quick View ships on — it publishes nothing a shopper could not already open",
  defaults.enabled
);
check("the default button says Quick View", defaults.buttonLabel === "Quick View");
check("Direct Checkout in the modal ships off", !defaults.directCheckoutEnabled);
check(
  "a blank label falls back rather than shipping a nameless button",
  settingsWith({ buttonLabel: "   " }).quickView.buttonLabel === "Quick View"
);
check(
  "a seller's own label survives",
  settingsWith({ buttonLabel: "Peek" }).quickView.buttonLabel === "Peek"
);
check(
  "a blank full-details link falls back",
  settingsWith({ fullDetailsText: "" }).quickView.fullDetailsText === "View full details"
);
check(
  "an absurd description length is clamped rather than obeyed",
  settingsWith({ descriptionLength: 9000 }).quickView.descriptionLength === 600 &&
    settingsWith({ descriptionLength: 2 }).quickView.descriptionLength === 60
);
check(
  "a description length that is not a number falls back to the default",
  settingsWith({ descriptionLength: "lots" }).quickView.descriptionLength ===
    defaults.descriptionLength
);
check(
  "an unknown trigger style reads as the default rather than reaching a class name",
  settingsWith({ triggerStyle: "telepathy" }).quickView.triggerStyle === "hover"
);
check(
  "settings absent entirely still produce the full default",
  normalizeAdvancedSettings(undefined).quickView.enabled === defaults.enabled
);

console.log("\n=== The view every card reads ===");

check("a shop with Quick View off publishes no view", buildQuickViewView(settingsWith({ enabled: false })) === null);

const view = buildQuickViewView(normalizeAdvancedSettings({}));

check("a shop with it on publishes one", view !== null);

const productPage = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productPage;

check(
  "the buy button is named once, by Product Page",
  view?.addToCartText === productPage.addToCartText &&
    view?.directCheckoutText === productPage.directCheckoutText
);
check(
  "the buy button is coloured once, by Product Page",
  view?.addToCartButtonColor === productPage.addToCartButtonColor &&
    view?.addToCartButtonRadius === productPage.addToCartButtonRadius
);
check(
  "the option control matches the product page's style",
  view?.variantStyle === productPage.variantStyle
);
check(
  "Direct Checkout in the modal is Quick View's own switch, not the product page's",
  buildQuickViewView(
    normalizeAdvancedSettings({
      productPage: { directCheckoutEnabled: true },
      quickView: { directCheckoutEnabled: false }
    })
  )?.directCheckoutEnabled === false &&
    buildQuickViewView(
      normalizeAdvancedSettings({
        productPage: { directCheckoutEnabled: false },
        quickView: { directCheckoutEnabled: true }
      })
    )?.directCheckoutEnabled === true
);
check(
  "the view carries no product, no store and no description length",
  view !== null &&
    !("product" in view) &&
    !("storeId" in view) &&
    !("descriptionLength" in view)
);

console.log("\n=== The description a modal has room for ===");

check(
  "markup is removed rather than rendered",
  quickViewSummary("<p>Warm <b>and</b> light</p>", 200) === "Warm and light"
);
check(
  "a script a supplier pasted in cannot survive as text either",
  !quickViewSummary("<script>alert(1)</script>Warm", 200).includes("<")
);
check(
  "entities are decoded, so an ampersand is one character",
  quickViewSummary("Salt &amp; Pepper", 200) === "Salt & Pepper"
);
check(
  "whitespace is collapsed",
  quickViewSummary("Warm\n\n   and    light", 200) === "Warm and light"
);
check(
  "text that already fits gets no ellipsis promising more",
  quickViewSummary("Short enough", 200) === "Short enough"
);

const cut = quickViewSummary("Antibacterial merino wool socks for everyday wear", 20);

check("a long description is cut", cut.length <= 21 && cut.endsWith("…"));
check("the cut lands on a whole word", !cut.replace("…", "").endsWith("meri"));
check(
  "no dangling punctuation is left in front of the ellipsis",
  quickViewSummary("One, two, three, four", 5) === "One…"
);
check("an absent description is empty rather than 'null'", quickViewSummary(null, 200) === "");
check(
  "a nonsense length still produces something",
  quickViewSummary("Warm and light", 0) === "…" || quickViewSummary("Warm and light", 0).length <= 2
);

console.log("\n=== The saving claimed on the badge ===");

check("a real discount is a whole percent", quickViewSavings("1800.00", "2400.00") === 25);
check("no compare-at price claims nothing", quickViewSavings("1800.00", null) === null);
check("an equal compare-at price claims nothing", quickViewSavings("1800.00", "1800.00") === null);
check(
  "a compare-at price below the price claims nothing rather than a negative",
  quickViewSavings("1800.00", "1200.00") === null
);
check("an unreadable compare-at price claims nothing", quickViewSavings("1800.00", "free") === null);
check("a blank compare-at price claims nothing", quickViewSavings("1800.00", "") === null);
check(
  "the percentage is rounded down, so a shop is never caught overstating it",
  quickViewSavings("50.50", "100.00") === 49
);
check(
  "a saving too small to be a whole percent shows no badge rather than 0% off",
  quickViewSavings("999.00", "1000.00") === null
);
check(
  "money is compared in whole cents, not in floats",
  quickViewSavings("0.30", "0.60") === 50 && quickViewSavings("70.07", "70.07") === null
);

console.log("\n=== The payload the browser receives ===");

const payload = buildQuickViewProduct({
  currency: "BDT",
  descriptionLength: 180,
  product: { ...PRODUCT },
  storeId: "store_1",
  variants: [
    {
      compareAtPrice: null,
      continueSelling: false,
      id: "var_1",
      imageUrl: null,
      optionSignature: "size:m",
      price: "1800.00",
      sku: "JKT-01-M",
      status: "ACTIVE",
      stockQuantity: 3,
      title: "Medium"
    },
    {
      id: "var_2",
      optionSignature: "size:l",
      price: "1900.00",
      status: "INACTIVE",
      stockQuantity: 4,
      title: "Large"
    }
  ]
});

const EXPECTED_FIELDS = [
  "allowPreorder",
  "categoryName",
  "compareAtPrice",
  "currency",
  "description",
  "id",
  "images",
  "preorderReleaseAt",
  "price",
  "savingsPercent",
  "sku",
  "slug",
  "stockQuantity",
  "storeId",
  "title",
  "variants"
];

check(
  "the payload is exactly the fields named — adding one has to be deliberate",
  Object.keys(payload).sort().join(",") === EXPECTED_FIELDS.sort().join(","),
  Object.keys(payload).sort().join(",")
);
check(
  "no cost price, supplier or demo-pack marker can ride along",
  !("costPrice" in payload) && !("isDemoContent" in payload) && !("demoPackId" in payload)
);
check("the saving is computed once, on the server", payload.savingsPercent === 25);
check("the category comes through as a name rather than a row", payload.categoryName === "Outerwear");
check(
  "an option the seller switched off is dropped rather than hidden",
  payload.variants.length === 1 && payload.variants[0]?.id === "var_1"
);
check(
  "a variant's own fields are narrowed to what a selector needs",
  Object.keys(payload.variants[0] ?? {})
    .sort()
    .join(",") ===
    "compareAtPrice,continueSelling,id,imageUrl,optionSignature,price,sku,stockQuantity,title"
);
check(
  "the seller's short description wins over the long one",
  buildQuickViewProduct({
    currency: "BDT",
    descriptionLength: 180,
    product: { ...PRODUCT, shortDescription: "Cut for Dhaka winters." },
    storeId: "store_1",
    variants: []
  }).description === "Cut for Dhaka winters."
);
check(
  "the seller's length is the one applied",
  buildQuickViewProduct({
    currency: "BDT",
    descriptionLength: 60,
    product: { ...PRODUCT },
    storeId: "store_1",
    variants: []
  }).description === PRODUCT.description
);
check(
  "every inactive option is dropped, not only the last",
  activeQuickViewVariants([
    { id: "a", optionSignature: "a", price: "1", status: "INACTIVE", stockQuantity: 0, title: "A" },
    { id: "b", optionSignature: "b", price: "1", status: "ACTIVE", stockQuantity: 1, title: "B" },
    { id: "c", optionSignature: "c", price: "1", status: "INACTIVE", stockQuantity: 9, title: "C" }
  ]).map((variant) => variant.id).join(",") === "b"
);

console.log("\n=== What the stepper may ask for ===");

check(
  "an ordinary product caps at its stock",
  quickViewMaxQuantity({ allowPreorder: false, stockQuantity: 7 }) === 7
);
check(
  "an out-of-stock product caps at zero, which the panel reads as unavailable",
  quickViewMaxQuantity({ allowPreorder: false, stockQuantity: 0 }) === 0
);
check(
  "negative stock — a pre-order that is owed — never becomes a negative cap",
  quickViewMaxQuantity({ allowPreorder: false, stockQuantity: -4 }) === 0
);
check(
  "a pre-order product is not capped by stock it does not have",
  quickViewMaxQuantity({ allowPreorder: true, stockQuantity: -4 }) > 1000
);
check(
  "a selected option's stock wins over the product's",
  quickViewMaxQuantity({
    allowPreorder: false,
    stockQuantity: 7,
    variant: { continueSelling: false, stockQuantity: 2 }
  }) === 2
);
check(
  "an option that continues selling is not capped by its own stock",
  quickViewMaxQuantity({
    allowPreorder: false,
    stockQuantity: 7,
    variant: { continueSelling: true, stockQuantity: 0 }
  }) > 1000
);

console.log("\n=== The product is re-read, never quoted ===");

check(
  "the store is resolved from the slug, by the storefront's own reader",
  code(source.service).includes("getStorefrontBySlug(storeSlug)")
);
check(
  "the product is read through the resolver, which carries publicProductWhere",
  code(source.service).includes("getStorefrontProductBySlug(store.id, productSlug)")
);
check(
  "the service is asked for a product by slug, never by id",
  /getQuickViewProduct\(\s*storeSlug: string,\s*productSlug: string/.test(code(source.service))
);
check(
  "no storeId reaches the service from outside — it is the slug's own answer",
  !/getQuickViewProduct\([^)]*storeId/.test(code(source.service))
);
check(
  "the route accepts two slugs and nothing else",
  code(source.route).includes('searchParams.get("store")') &&
    code(source.route).includes('searchParams.get("product")') &&
    !code(source.route).includes("storeId")
);
check(
  "the route reads rather than writes: no POST handler on a public endpoint",
  !/export async function POST/.test(code(source.route))
);
check(
  "the payload is built by the one named-field function",
  code(source.service).includes("buildQuickViewProduct(")
);
check(
  "the modal is handed a product from the server, not props off a card",
  code(source.provider).includes("/api/storefront/quick-view?store=") &&
    !code(source.card).includes("QuickViewProduct")
);
check(
  "the browser posts no store id when it asks",
  !/quick-view\?[^`]*storeId/.test(code(source.provider))
);

console.log("\n=== Off means off ===");

check(
  "the seller's switch is re-read on the server, not trusted from the page that asked",
  code(source.service).includes("resolveQuickView(store.id)") &&
    /if \(!view\) \{\s*return null;/.test(code(source.service))
);
check(
  "the trigger renders nothing at all when Quick View is off",
  /if \(!view\) \{\s*return null;\s*\}/.test(code(source.trigger))
);
check(
  "no dialog is mounted for a shop that has it off, or before a card is tapped",
  code(source.provider).includes("{view && activeSlug ? (")
);
check(
  "a store with it off produces the same 404 as a product that does not exist",
  (code(source.route).match(/status: 404/g) ?? []).length === 1
);

console.log("\n=== Borrowed, not rebuilt ===");

check(
  "the dialog sells through the product page's own buy box",
  code(source.modal).includes("<ProductPurchasePanel")
);
check(
  "the dialog posts to no cart endpoint of its own",
  !code(source.modal).includes("/api/cart")
);
check(
  "the saving on a picked option is the server's rule, not a second copy",
  code(source.modal).includes("quickViewSavings(") &&
    !/function savingsFor/.test(code(source.modal))
);
check(
  "the dialog is portalled into the shop's theme scope, so it wears the shop's colours",
  code(source.modal).includes('querySelector<HTMLElement>(".sf-theme-scope")')
);
check(
  "one provider for the whole storefront, mounted from the layout",
  code(source.layout).includes("<QuickViewProvider") &&
    code(source.layout).includes("resolveQuickView(store.id)")
);
check(
  "the card carries a button and nothing else",
  code(source.card).includes("<QuickViewTrigger") && !code(source.card).includes("QuickViewModal")
);

console.log("");

if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}

console.log("All checks passed.");
