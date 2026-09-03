/**
 * Direct Checkout check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * product page's Direct Checkout button — the same shape as
 * `verify-free-shipping.mts`, and deliberately the half that needs neither a
 * database nor a request.
 *
 * The feature is one sentence: **buy this one thing, and leave my cart alone.**
 * Everything below is that sentence made checkable, because it is the half a
 * refactor breaks silently — a direct order that quietly bills the shopper's
 * cart, or clears it, looks exactly like a working checkout until someone reads
 * their order.
 *
 * Four things are driven.
 *
 * The *scope* checks run `parseCartScope` and `checkoutSchema` for real. The
 * scope is a value the browser posts and it picks which cookie is read, so it is
 * a closed enum: anything unrecognised has to come back as the ordinary cart,
 * never as a throw, and never as itself.
 *
 * The *isolation* checks read `cart.service.ts` as text. "The two baskets never
 * touch" is a property of the file — every ordinary-cart function naming
 * `"cart"`, and the direct one naming `"direct"` and nothing else — whereas one
 * correct call proves nothing about the next. This is also the strongest place
 * to assert the *replace*: a direct buy that merged would resurrect whatever the
 * shopper abandoned last time.
 *
 * The *reuse* checks tie the feature to the checkout the cart already uses. A
 * direct order is not a second way to sell: it goes through the same
 * `createCheckoutOrder`, so stock, coupons, bundles, the order bump, the
 * blocklist, plan limits, fraud scoring and the one-submission-one-order index
 * all still apply — and the line is validated by the same functions an add is,
 * because the cart page where the shopper would otherwise have seen the problem
 * is exactly what this button skips.
 *
 * The *seller* checks drive `normalizeAdvancedSettings` for real. The button is
 * off until a seller asks for it, its label is theirs, and the setting they had
 * already switched on under the old name survives being renamed.
 *
 * Covers:
 * - an unknown, blank, absent or null scope reading as the ordinary cart;
 * - the checkout schema narrowing a posted scope rather than trusting or
 *   rejecting it, and posting no price, product or store of its own;
 * - the two baskets living in two cookies, and every ordinary-cart function
 *   naming its scope explicitly;
 * - a direct buy replacing rather than merging, and minting its own token;
 * - the direct cookie expiring sooner than the cart's;
 * - the direct line being validated by the same public-product, variant and
 *   stock checks an add uses;
 * - the price coming from the catalogue row, never from the form;
 * - checkout reading, settling and clearing one scope throughout — and no
 *   unscoped `clearCart` left to empty a cart the shopper never checked out;
 * - the order still going through `createCheckoutOrder`, with the cart route
 *   creating none of its own;
 * - the checkout page choosing the basket from the URL rather than from
 *   whichever cookie happens to exist;
 * - the button leaving the cart alone: no cart event, no revalidation;
 * - the seller's switch defaulting to off, the legacy key still being read, and
 *   a blank label falling back to the default.
 *
 * Run with: npm run verify:direct-checkout
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CART_SCOPES, parseCartScope } from "../apps/web/src/modules/cart/cart.types";
import { checkoutSchema } from "../apps/web/src/modules/checkout/checkout.schema";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings
} from "../apps/web/src/modules/storefront/customization";

const WEB_DIR = join(process.cwd(), "apps", "web", "src");

const source = {
  cartRoute: read("app", "api", "cart", "route.ts"),
  cartService: read("modules", "cart", "cart.service.ts"),
  checkoutPage: read("app", "storefront", "[slug]", "checkout", "page.tsx"),
  checkoutRoute: read("app", "api", "checkout", "route.ts"),
  checkoutService: read("modules", "checkout", "checkout.service.ts"),
  panel: read("modules", "storefront", "components", "product-purchase-panel.tsx")
};

/** A form that would place an order, so the scope is the only thing varying. */
const ORDER = {
  addressLine1: "House 12, Road 4, Dhanmondi",
  district: "Dhaka",
  email: "",
  name: "Rahim Uddin",
  paymentMethod: "COD",
  phone: "01711223344",
  shippingRateId: "rate_inside_dhaka"
} as const;

let failures = 0;

function read(...parts: string[]) {
  return readFileSync(join(WEB_DIR, ...parts), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks that assert a name is *absent* have to read the code: the doc
 * comments name `clearCart(store.id)` and the cart cookie while explaining the
 * rules about them, and scanning the raw file would fail on its own
 * explanation — the worst kind of check, because it punishes the comment that
 * makes the guarantee legible.
 */
function code(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

/** The body of one function, so a claim about it cannot be met by its neighbour. */
function body(text: string, signature: string) {
  const start = code(text).indexOf(signature);

  if (start < 0) {
    return "";
  }

  const rest = code(text).slice(start);
  const end = rest.indexOf("\n}\n");

  return end < 0 ? rest : rest.slice(0, end);
}

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("=== Scope ===");

check("the scope enum is exactly the two baskets", CART_SCOPES.join(",") === "cart,direct");
check("\"direct\" is read as itself", parseCartScope("direct") === "direct");
check("\"cart\" is read as itself", parseCartScope("cart") === "cart");

for (const [label, value] of [
  ["an unknown scope", "everything"],
  ["a blank scope", ""],
  ["an absent scope", undefined],
  ["a null scope", null],
  ["a scope in the wrong case", "DIRECT"]
] as const) {
  check(`${label} reads as the ordinary cart`, parseCartScope(value) === "cart");
}

const direct = checkoutSchema.safeParse({ ...ORDER, checkoutScope: "direct" });
const nonsense = checkoutSchema.safeParse({ ...ORDER, checkoutScope: "their-cart" });
const absent = checkoutSchema.safeParse(ORDER);

check("an order posting no scope still parses", absent.success);
check("a direct order parses", direct.success && direct.data.checkoutScope === "direct");
check(
  "an invented scope is narrowed rather than refused",
  nonsense.success && nonsense.data.checkoutScope === "cart"
);
check(
  "the form posts no price, product or store of its own",
  !("price" in checkoutSchema.shape) &&
    !("storeId" in checkoutSchema.shape) &&
    !("items" in checkoutSchema.shape)
);
check(
  "the route narrows the posted scope before it reaches a cookie name",
  code(source.checkoutRoute).includes('parseCartScope(getValue(formData, "checkoutScope"))')
);

console.log("\n=== Two baskets, never one ===");

check(
  "the cookie name is a function of the scope, from two prefixes",
  /function cookieName\(storeId: string, scope: CartScope\)/.test(code(source.cartService)) &&
    code(source.cartService).includes("DIRECT_COOKIE_PREFIX") &&
    code(source.cartService).includes("CART_COOKIE_PREFIX")
);
check(
  "the two prefixes differ, so one basket cannot overwrite the other",
  /const CART_COOKIE_PREFIX = "dash_cart"/.test(source.cartService) &&
    /const DIRECT_COOKIE_PREFIX = "dash_direct"/.test(source.cartService)
);

const directBuy = body(source.cartService, "export async function startDirectCheckout");

check("startDirectCheckout exists", directBuy.length > 0);
check(
  "it writes the direct basket and only the direct basket",
  directBuy.includes('"direct"') && !directBuy.includes('"cart"')
);
check(
  "it never reads the shopper's cart, so it cannot bill or empty it",
  !directBuy.includes("readStoredCart")
);
check(
  "it replaces rather than merges — one direct buy is not two",
  !directBuy.includes("upsertItem") && directBuy.includes("[item]")
);
check("it mints its own snapshot token", directBuy.includes("createCartToken()"));
check(
  "the direct cookie expires sooner than the cart's",
  /const DIRECT_COOKIE_MAX_AGE = 60 \* 60 \* 2;/.test(source.cartService) &&
    /const CART_COOKIE_MAX_AGE = 60 \* 60 \* 24 \* 30;/.test(source.cartService)
);

for (const fn of [
  "export async function addToCart",
  "export async function updateCartItemQuantity",
  "export async function removeCartItem",
  "export async function setCartNote"
]) {
  const name = fn.replace("export async function ", "");

  check(
    `${name} names the ordinary cart explicitly`,
    body(source.cartService, fn).includes('readStoredCart(storeId, "cart")')
  );
}

console.log("\n=== The same checkout, not a second one ===");

check(
  "the direct line is validated by the same public-product read an add uses",
  directBuy.includes("getPublicProductForCart") && directBuy.includes("getActiveCartVariant")
);
check(
  "and by the same stock ceiling, so a bypassed cart page hides nothing",
  directBuy.includes("ensureStockAllows(availableStockFor(")
);
check(
  "the price is read from the catalogue row, never from the caller",
  directBuy.includes("variant?.price ?? product.price.toString()") &&
    !/\bprice[,)]/.test(directBuy.split("const item")[0] ?? "")
);
check(
  "the cart route opens a direct basket rather than placing an order",
  code(source.cartRoute).includes("startDirectCheckout(") &&
    !code(source.cartRoute).includes("createCheckoutOrder")
);
check(
  "the order still goes through createCheckoutOrder",
  code(source.checkoutRoute).includes("createCheckoutOrder(store, {")
);

const scopedService = code(source.checkoutService);

check(
  "checkout settles the snapshot belonging to the basket it is checking out",
  scopedService.includes("getCartToken(store.id, scope)")
);
check("checkout reads the basket it was opened for", scopedService.includes("getCart(store.id, scope)"));
check(
  "checkout clears only that basket",
  scopedService.includes("clearCart(store.id, scope)")
);
check(
  "no unscoped clearCart survives, which would empty a cart nobody checked out",
  !/clearCart\(store\.id\)/.test(scopedService)
);
check(
  "no unscoped getCart survives, which would bill a cart nobody chose",
  !/getCart\(store\.id\)/.test(scopedService)
);
check(
  "one scope is resolved once and threaded, not re-read per call site",
  (scopedService.match(/parseCartScope\(/g) ?? []).length === 1
);

console.log("\n=== The shopper's cart is left alone ===");

check(
  "the checkout page picks the basket from the URL, not from a stray cookie",
  code(source.checkoutPage).includes("parseCartScope(buy)") &&
    code(source.checkoutPage).includes("getCart(store.id, scope)")
);
check(
  "an expired direct basket says so rather than claiming the cart is empty",
  source.checkoutPage.includes("This direct checkout has expired")
);

const handler = body(source.panel, "async function handleDirectCheckout");

check("the button has its own handler", handler.length > 0);
check(
  "it opens a direct basket",
  handler.includes('submitSelection("direct")') && handler.includes("?buy=direct")
);
check(
  "it fires no cart event, so the header does not count what the order will not include",
  !handler.includes("notifyCartUpdated")
);
check(
  "the cart route revalidates nothing for a direct buy — nothing in the cart changed",
  !/cartAction === "direct"[\s\S]*?revalidateStorefrontCart/.test(
    code(source.cartRoute).split('cartAction === "update"')[0] ?? ""
  )
);

console.log("\n=== Seller control ===");

const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productPage;

check("a shop that never asked for the button does not get one", !defaults.directCheckoutEnabled);
check("the default label is the feature's own name", defaults.directCheckoutText === "Direct Checkout");

const renamed = normalizeAdvancedSettings({ productPage: { buyNowEnabled: true } });
const chosen = normalizeAdvancedSettings({
  productPage: { directCheckoutEnabled: true, directCheckoutText: "  অর্ডার করুন  " }
});
const blank = normalizeAdvancedSettings({
  productPage: { directCheckoutEnabled: true, directCheckoutText: "   " }
});
const off = normalizeAdvancedSettings({
  productPage: { buyNowEnabled: true, directCheckoutEnabled: false }
});

check(
  "a seller who switched the old Buy Now on still has a button",
  renamed.productPage.directCheckoutEnabled
);
check(
  "and the new key wins over the old one, so switching it off works",
  !off.productPage.directCheckoutEnabled
);
check(
  "the seller's own label is kept, trimmed, in whatever script they typed",
  chosen.productPage.directCheckoutText === "অর্ডার করুন"
);
check(
  "a blank label restores the default rather than shipping a nameless button",
  blank.productPage.directCheckoutText === "Direct Checkout"
);

console.log(
  failures === 0
    ? "\nDirect Checkout: all checks passed."
    : `\nDirect Checkout: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);
