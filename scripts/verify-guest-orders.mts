/**
 * Guest order history check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * account page a shopper reaches without ever making an account — the same shape
 * as `verify-quick-view.mts`, and deliberately the half that needs neither a
 * database nor a request.
 *
 * The feature is one sentence: **a purchase is remembered on the device that
 * made it, for three days.** Everything below is that sentence made checkable,
 * and it splits into the three ways this feature goes wrong quietly.
 *
 * The first is the **cookie becoming the record**. Pasting the order into the
 * cookie at checkout is the obvious implementation and it lies within the hour:
 * the seller confirms the order, the courier collects it, and the page keeps
 * reading "payment pending" off a snapshot taken at the moment of purchase — on
 * the one screen the customer opened to find out. So the cookie is asserted to
 * carry ids and timestamps only, and the orders are asserted to be re-read.
 *
 * The second is the **window not closing**. A signature proves this server wrote
 * the string, never that the string is still current, so an expired cookie that
 * comes back — restored, replayed, or simply kept by a browser that ignored
 * `maxAge` — must resolve to nothing on the server. That is driven here for
 * real, at the boundary.
 *
 * The third is the **query widening**. `Order` carries the seller's private
 * judgement of the customer reading the page: a risk score, the factors behind
 * it, the IP the order came from, and whether the seller marked it fake. A
 * `select` that ever became a spread would hand all four to that customer.
 *
 * Covers:
 * - three days, measured from the order rather than from the last visit;
 * - expired, future-dated, duplicate and malformed entries pruned on read;
 * - a tampered signature, another store's cookie and an old version all
 *   resolving to no orders at all;
 * - the cookie's `maxAge` tracking the newest order and never outliving it;
 * - the payload carrying exactly `at` and `id` — no name, phone, address or
 *   total;
 * - the orders re-read from the database, scoped by store *and* by the ids the
 *   cookie named, never by the customer's phone number;
 * - the seller's risk columns absent from the shopper's query;
 * - a device that has bought nothing getting the page exactly as it was;
 * - the receipt written for a replayed submission too, and unable to turn a
 *   committed order into a failed checkout;
 * - the page kept out of the index, with the `/s/` stub re-exporting the
 *   metadata that does it.
 *
 * Run with: npm run verify:guest-orders
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GUEST_ORDER_WINDOW_DAYS,
  GUEST_ORDER_WINDOW_MS,
  decodeGuestOrders,
  encodeGuestOrders,
  guestOrdersCookieMaxAge,
  guestOrdersCookieName,
  pruneGuestOrders,
  rememberGuestOrderRef
} from "../apps/web/src/modules/guest-orders/guest-orders.cookie";
import {
  buildGuestAccountView,
  buildGuestOrderView,
  guestOrderExpiryLabel,
  guestOrderStatusLabel,
  type GuestOrderRow
} from "../apps/web/src/modules/guest-orders/guest-orders.render";

const WEB_DIR = join(process.cwd(), "apps", "web", "src");
const NOW = Date.UTC(2026, 8, 3, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const source = {
  checkout: read("modules", "checkout", "checkout.service.ts"),
  cookie: read("modules", "guest-orders", "guest-orders.cookie.ts"),
  forgetRoute: read("app", "api", "storefront", "guest-orders", "route.ts"),
  history: read("modules", "guest-orders", "components", "guest-order-history.tsx"),
  page: read("app", "storefront", "[slug]", "account", "page.tsx"),
  repository: read("modules", "guest-orders", "guest-orders.repository.ts"),
  service: read("modules", "guest-orders", "guest-orders.service.ts"),
  stub: read("app", "s", "[slug]", "account", "page.tsx")
};

/** An order row, so only the field under test varies. */
const ORDER: GuestOrderRow = {
  bundleDiscountAmount: "0.00",
  createdAt: new Date(NOW - 2 * HOUR),
  currency: "BDT",
  customerEmail: null,
  customerName: "Rahim Uddin",
  customerPhone: "01710000000",
  discountAmount: "0.00",
  fulfillmentStatus: "UNFULFILLED",
  id: "order_1",
  items: [
    {
      id: "item_1",
      imageUrl: "/uploads/shirt.jpg",
      isPreorder: false,
      quantity: 2,
      title: "Colorful T Shirt",
      total: "1800.00"
    }
  ],
  orderNumber: "ORD-1001",
  paymentMethodName: "Cash on delivery",
  paymentStatus: "PENDING",
  shippingAddress: {
    addressLine1: "House 12, Road 4",
    addressLine2: null,
    area: "Mirpur 10",
    city: "Dhaka",
    country: "Bangladesh",
    district: "Dhaka",
    postalCode: "1216"
  },
  shippingAmount: "70.00",
  shippingArea: null,
  shippingCity: null,
  shippingDistrict: null,
  shippingRateName: "Inside Dhaka",
  status: "PENDING",
  subtotalAmount: "1800.00",
  taxAmount: "0.00",
  totalAmount: "1870.00"
};

let failures = 0;

function read(...parts: string[]) {
  return readFileSync(join(WEB_DIR, ...parts), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks that assert a name is *absent* have to read the code: the doc
 * comments here name `riskScore`, `customerPhone` and "snapshot" while
 * explaining the rules about them, and scanning the raw file would fail on its
 * own explanation — the worst kind of check, because it punishes the comment
 * that makes the guarantee legible.
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

function orderRow(overrides: Partial<GuestOrderRow>): GuestOrderRow {
  return { ...ORDER, ...overrides };
}

console.log("=== The window ===");

check("three days, stated once", GUEST_ORDER_WINDOW_DAYS === 3);
check("and derived, not typed twice", GUEST_ORDER_WINDOW_MS === 3 * DAY);
check(
  "an order from this morning is kept",
  pruneGuestOrders([{ at: NOW - 6 * HOUR, id: "order_1" }], NOW).length === 1
);
check(
  "an order one hour short of the window is still kept",
  pruneGuestOrders([{ at: NOW - (GUEST_ORDER_WINDOW_MS - HOUR), id: "order_1" }], NOW).length === 1
);
check(
  "an order one hour past it is gone",
  pruneGuestOrders([{ at: NOW - (GUEST_ORDER_WINDOW_MS + HOUR), id: "order_1" }], NOW).length === 0
);
check(
  "the window runs from the order, so browsing cannot extend it",
  // The same ref, read a day later, has a day less left on it.
  guestOrdersCookieMaxAge(pruneGuestOrders([{ at: NOW - DAY, id: "order_1" }], NOW), NOW) ===
    (2 * DAY) / 1000
);
check(
  "an order dated in the future is dropped rather than trusted",
  pruneGuestOrders([{ at: NOW + DAY, id: "order_1" }], NOW).length === 0
);

console.log("\n=== What the cookie carries ===");

const cookie = encodeGuestOrders("store_1", [{ at: NOW - HOUR, id: "order_1" }]);
const decodedPayload = JSON.parse(
  Buffer.from(cookie.slice(0, cookie.lastIndexOf(".")), "base64url").toString("utf8")
) as { orders: Record<string, unknown>[] };

check(
  "one remembered order carries exactly an id and a timestamp",
  JSON.stringify(Object.keys(decodedPayload.orders[0] ?? {}).sort()) === '["at","id"]',
  JSON.stringify(decodedPayload.orders[0])
);
check(
  "no customer detail is written into the cookie",
  !/customerName|customerPhone|customerEmail|address|total|status/i.test(
    code(source.cookie).replace(/GuestOrderRef|guestOrders/g, "")
  )
);
check(
  "the module has no database import — the cookie cannot become the record",
  !source.cookie.includes("@dash/db")
);
check("the cookie is named per store", guestOrdersCookieName("store_1") === "dash_orders_store_1");

console.log("\n=== A cookie is not a permission ===");

check(
  "a valid cookie reads back",
  decodeGuestOrders(cookie, "store_1", NOW).length === 1,
  "the signed round trip failed"
);
check(
  "an edited order id is refused",
  decodeGuestOrders(
    `${Buffer.from(JSON.stringify({ orders: [{ at: NOW, id: "order_someone_else" }], storeId: "store_1", version: 1 }), "utf8").toString("base64url")}.${cookie.slice(cookie.lastIndexOf(".") + 1)}`,
    "store_1",
    NOW
  ).length === 0
);
check(
  "another shop's cookie resolves to nothing here",
  decodeGuestOrders(cookie, "store_2", NOW).length === 0
);
check(
  "garbage resolves to nothing",
  decodeGuestOrders("not-a-cookie", "store_1", NOW).length === 0
);
check(
  "an expired cookie replayed with its own valid signature still resolves to nothing",
  decodeGuestOrders(
    encodeGuestOrders("store_1", [{ at: NOW - 4 * DAY, id: "order_1" }]),
    "store_1",
    NOW
  ).length === 0,
  "the window is enforced on the server, not only by the browser"
);

console.log("\n=== The list ===");

const remembered = rememberGuestOrderRef(
  [
    { at: NOW - 2 * DAY, id: "order_old" },
    { at: NOW - 5 * DAY, id: "order_expired" }
  ],
  { at: NOW, id: "order_new" },
  NOW
);

check("the newest purchase is first", remembered[0]?.id === "order_new");
check("what is still inside the window comes with it", remembered[1]?.id === "order_old");
check("what is past it does not", remembered.length === 2);
check(
  "the same order remembered twice is listed once — a double-tapped submit is one purchase",
  rememberGuestOrderRef([{ at: NOW - HOUR, id: "order_1" }], { at: NOW, id: "order_1" }, NOW)
    .length === 1
);
check(
  "a malformed entry is dropped rather than rendered",
  pruneGuestOrders([{ id: "order_1" }, { at: NOW }, null, "order_2"], NOW).length === 0
);
check(
  "the browser is asked to keep the cookie only as long as the newest order lives",
  guestOrdersCookieMaxAge(
    [
      { at: NOW - DAY, id: "a" },
      { at: NOW, id: "b" }
    ],
    NOW
  ) ===
    GUEST_ORDER_WINDOW_MS / 1000
);
check("an empty list asks for nothing", guestOrdersCookieMaxAge([], NOW) === 0);

console.log("\n=== The page ===");

const view = buildGuestAccountView(
  [
    orderRow({ createdAt: new Date(NOW - 2 * DAY), id: "order_old", orderNumber: "ORD-1000" }),
    orderRow({ customerName: "Rahim Uddin", id: "order_1" })
  ],
  [
    { at: NOW - 2 * DAY, id: "order_old" },
    { at: NOW - 2 * HOUR, id: "order_1" }
  ],
  NOW
);

check("nothing bought, nothing shown", buildGuestAccountView([], [], NOW) === null);
check("the newest order leads", view?.orders[0]?.orderNumber === "ORD-1001");
check(
  "the profile is what was last typed into checkout",
  view?.profile.name === "Rahim Uddin" && view?.profile.phone === "01710000000"
);
check(
  "the address is the most recent order's, in delivery order",
  JSON.stringify(view?.address) ===
    JSON.stringify(["House 12, Road 4", "Mirpur 10, Dhaka, Dhaka", "1216, Bangladesh"])
);
check(
  "an order with no address row still says where it went",
  JSON.stringify(
    buildGuestAccountView(
      [
        orderRow({
          shippingAddress: null,
          shippingCity: "Dhaka",
          shippingDistrict: "Dhaka"
        })
      ],
      [{ at: NOW, id: "order_1" }],
      NOW
    )?.address
  ) === JSON.stringify(["Dhaka, Dhaka"])
);
check(
  "each order says when it leaves the device",
  view?.orders[0]?.expiryLabel === "Kept on this device for 2 more days"
);
check(
  "and counts in hours once a day is left",
  guestOrderExpiryLabel(NOW + 5 * HOUR, NOW) === "Kept on this device for 5 more hours"
);
check(
  "a status is said in the shop's words, not the enum's",
  guestOrderStatusLabel("PENDING") === "Order placed" &&
    guestOrderStatusLabel("PROCESSING") === "Being prepared"
);
check(
  "an unknown status reads oddly rather than wrongly",
  guestOrderStatusLabel("AWAITING_PICKUP") === "Awaiting pickup"
);

const totals = buildGuestOrderView(
  orderRow({ bundleDiscountAmount: "50.00", discountAmount: "100.00" }),
  NOW + DAY,
  NOW
);

check(
  "the two discounts are added into one line the buyer can read",
  totals.discount === "৳150.00"
);
check(
  "a zero discount is absent rather than a formatted zero",
  buildGuestOrderView(ORDER, NOW + DAY, NOW).discount === null
);
check("a zero tax likewise", buildGuestOrderView(ORDER, NOW + DAY, NOW).tax === null);
check("money is the storefront's own formatter", totals.total.includes("1,870.00"));
check(
  "the line carries a quantity and a title, and no price of its own to disagree with",
  JSON.stringify(Object.keys(totals.lines[0] ?? {}).sort()) ===
    '["id","imageUrl","isPreorder","quantity","title","total"]'
);

console.log("\n=== Re-read, never quoted ===");

check(
  "the account page asks the service, not the cookie",
  code(source.page).includes("getGuestAccountView(store.id)")
);
check(
  "the service re-reads the orders the cookie named",
  code(source.service).includes("findGuestOrdersByIds") &&
    code(source.service).includes("decodeGuestOrders")
);
check(
  "the query is scoped by the store and by those ids",
  code(source.repository).includes("id: { in: [...ids] }") &&
    code(source.repository).includes("storeId")
);
check(
  "and never by the customer's phone number, which would publish someone else's history",
  // Everything before `select:` is the filter half of the query. The phone is
  // fine as a *returned* field — it is the shopper's own, and their profile card
  // is made of it — but as a `where` it would turn one device's receipt into
  // every order that number ever placed, on any device.
  !(code(source.repository).split("select:")[0] ?? "").includes("customerPhone")
);
check(
  "the seller's private judgement of the customer stays with the seller",
  !/riskScore|riskFactors|riskLevel|ipAddress|markedFakeAt|verificationStatus/.test(
    code(source.repository)
  )
);
check(
  "the cookie is http-only, so nothing on the storefront can read the order id",
  code(source.service).includes("httpOnly: true")
);
check(
  "expired entries are filtered on read rather than written back",
  !code(source.service).includes("cookieStore.set") ||
    code(source.service).split("cookieStore.set").length === 2
);

console.log("\n=== Checkout leaves the receipt ===");

check(
  "one place writes it, so the chat and the checkout form agree",
  (code(source.checkout).match(/rememberGuestOrder\(/g) ?? []).length === 1
);
check(
  "written for a replayed submission too — a lost receipt is not a duplicate SMS",
  /const result = await resolveCheckoutOrder\([\s\S]{0,200}rememberGuestOrder\(/.test(
    code(source.checkout)
  )
);
check(
  "and it cannot turn a committed order into a failed checkout",
  /rememberGuestOrder\([^;]*\)\s*\.catch\(/.test(code(source.checkout))
);

console.log("\n=== The device is not an account ===");

check(
  "a device that has bought nothing gets the page it always had",
  code(source.page).includes("Coming soon") && code(source.page).includes("account ? (")
);
check(
  "the shopper can clear their own details without client JavaScript",
  code(source.history).includes('method="post"') &&
    code(source.history).includes('action="/api/storefront/guest-orders"')
);
check(
  "clearing deletes the cookie and leaves the shop's order alone",
  code(source.forgetRoute).includes("forgetGuestOrders(store.id)") &&
    !code(source.forgetRoute).includes("prisma")
);
check(
  "the tenant comes from the slug, never from a posted store id",
  code(source.forgetRoute).includes("getStorefrontBySlug(storeSlug)") &&
    !code(source.forgetRoute).includes("storeId")
);
check("one shopper's cookie is kept out of the index", code(source.page).includes("index: false"));
check(
  "and the stub that actually renders re-exports the metadata that says so",
  source.stub.includes("metadata")
);

console.log("");

if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}

console.log("All checks passed.");
