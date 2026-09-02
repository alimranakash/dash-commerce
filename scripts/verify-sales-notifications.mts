/**
 * Sales Notifications check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * storefront's social-proof widget, and — like `verify-shopping-agent.mts` — it
 * is deliberately the half that needs neither a database nor a session.
 *
 * Three things are worth checking and one of them is the whole feature.
 *
 * The *provenance* checks are the point. This widget publishes a sentence about
 * a real customer to every visitor of a shop, and the only reason a shopper
 * should believe it is that there is no way to type one in. So: events are built
 * from order rows and nothing else, cancelled and fake-marked orders are
 * excluded, products are narrowed by `publicProductWhere`, and the dashboard's
 * example card cannot reach a storefront file.
 *
 * The *redaction* checks drive the two pure functions across the inputs a real
 * checkout produces — a lower-case name, a one-word name, a phone number typed
 * into the name box, an address typed into the city box, Bangla — because every
 * one of those failures is a customer's private detail on a public page.
 *
 * The *gate* checks assert the plan is enforced in the action that writes,
 * that switching the widget **off** is not gated, and that the storefront
 * re-checks the plan rather than trusting a stored `true`.
 *
 * Covers:
 * - the feature key registered, and granted from Starter up;
 * - the settings schema's bounds and enums, including FormData's strings;
 * - defaults being off, and least-revealing where there is a choice;
 * - buyer names reduced to at most two tokens, and anything without letters
 *   falling back to "Someone";
 * - locations reduced to a town, with digits refused;
 * - events built only from order rows, with no fabricated path;
 * - cancelled / fake-marked orders and non-public products excluded;
 * - no private order column named anywhere in the module;
 * - the plan enforced on enable, ungated on disable, re-checked on render;
 * - the storefront layout mounting the dock, and the model matching the DDL.
 *
 * Run with: npm run verify:sales-notifications
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_CATALOG, isPaidFeature } from "../apps/web/src/modules/admin/plan-catalog";
import { PLAN_FEATURE_KEYS } from "../apps/web/src/modules/billing/plan-features";
import {
  redactBuyerName,
  resolveLocation
} from "../apps/web/src/modules/sales-notifications/sales-notifications.redact";
import {
  SALES_NOTIFICATION_DEFAULTS,
  SALES_NOTIFICATION_ORDER_STATUSES,
  salesNotificationSettingsSchema
} from "../apps/web/src/modules/sales-notifications/sales-notifications.schema";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

const MODULE_DIR = join(process.cwd(), "apps", "web", "src", "modules", "sales-notifications");

function read(file: string) {
  return readFileSync(join(MODULE_DIR, file), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks below that assert a name is *absent* — `customerPhone`,
 * `shippingArea` — have to read the code, because the doc comments name both
 * while explaining why neither is in the payload.
 */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const source = {
  actions: read("sales-notifications.actions.ts"),
  card: read(join("components", "sales-notification-card.tsx")),
  console: read(join("components", "sales-notifications-console.tsx")),
  dock: read(join("components", "sales-notification-dock.tsx")),
  feed: read(join("components", "sales-notification-feed.tsx")),
  redact: read("sales-notifications.redact.ts"),
  repository: read("sales-notifications.repository.ts"),
  schema: read("sales-notifications.schema.ts"),
  service: read("sales-notifications.service.ts")
};

const storefrontSource = [source.dock, source.feed, source.service, source.repository]
  .map(stripComments)
  .join("\n");

console.log("=== Entitlement ===");

check(
  "`sales_notifications` is a registered feature key",
  PLAN_FEATURE_KEYS.includes("sales_notifications")
);

const grantedBy = PLAN_CATALOG.filter((plan) => plan.features.includes("sales_notifications"))
  .map((plan) => plan.slug)
  .sort();

check(
  "the key is granted from Starter up",
  grantedBy.join(",") === "growth,pro,starter",
  grantedBy.join(", ") || "no plan grants it"
);

check("it is a paid feature", isPaidFeature("sales_notifications"));

console.log("\n=== Defaults ===");

check(
  "the defaults parse",
  salesNotificationSettingsSchema.safeParse(SALES_NOTIFICATION_DEFAULTS).success
);

check(
  // An entitled plan must never publish something on a seller's storefront by
  // itself. Same rule the AI Shopping Agent's switch follows.
  "the widget is off until a seller asks for it",
  SALES_NOTIFICATION_DEFAULTS.enabled === false
);

check(
  "the default name display is the least revealing of the two that name anyone",
  SALES_NOTIFICATION_DEFAULTS.nameDisplay === "initial"
);

check(
  "the default lookback is short enough for “just purchased” to be true",
  SALES_NOTIFICATION_DEFAULTS.lookbackDays <= 14
);

check(
  // A shop selling on delivery keeps most of its real sales in PENDING for
  // days, so a widget that counted only COMPLETED would show almost nothing.
  "every order status counts by default",
  SALES_NOTIFICATION_ORDER_STATUSES.every((status) =>
    SALES_NOTIFICATION_DEFAULTS.orderStatuses.includes(status)
  ),
  SALES_NOTIFICATION_DEFAULTS.orderStatuses.join(", ")
);

check(
  // The reason a shop with deleted products showed nothing at all.
  "an order for a product that is gone still counts by default",
  SALES_NOTIFICATION_DEFAULTS.requirePublicProduct === false
);

console.log("\n=== Settings bounds ===");

const bad: Array<[string, Record<string, unknown>]> = [
  ["a card shown for 2 seconds", { displaySeconds: 2 }],
  ["a card shown for 31 seconds", { displaySeconds: 31 }],
  ["a 4-second gap", { gapSeconds: 4 }],
  ["a 91-day lookback", { lookbackDays: 91 }],
  ["a 0-card session", { maxPerSession: 0 }],
  ["a 121-second first delay", { initialDelaySeconds: 121 }],
  ["an unknown name display", { nameDisplay: "full_name" }],
  ["an unknown position", { position: "middle" }],
  ["an empty status set", { orderStatuses: [] }],
  ["an unknown order status", { orderStatuses: ["DELIVERED"] }]
];

for (const [label, patch] of bad) {
  check(
    `${label} is refused`,
    !salesNotificationSettingsSchema.safeParse({ ...SALES_NOTIFICATION_DEFAULTS, ...patch }).success
  );
}

// The console posts through FormData, so every number arrives as a string.
const fromForm = salesNotificationSettingsSchema.safeParse({
  ...SALES_NOTIFICATION_DEFAULTS,
  displaySeconds: "9",
  gapSeconds: "25",
  initialDelaySeconds: "3",
  lookbackDays: "30",
  maxPerSession: "5"
});

check(
  "numbers submitted as strings are coerced",
  fromForm.success && fromForm.data.displaySeconds === 9 && fromForm.data.lookbackDays === 30
);

console.log("\n=== Buyer redaction ===");

const names: Array<[string, string | null, "anonymous" | "first_name" | "initial", string]> = [
  ["a full name keeps first name and initial", "Rahim Uddin", "initial", "Rahim U."],
  ["first-name mode drops the family name", "Rahim Uddin", "first_name", "Rahim"],
  ["anonymous names nobody", "Rahim Uddin", "anonymous", "Someone"],
  ["a lower-case name is capitalised", "rahim   uddin", "initial", "Rahim U."],
  ["a one-word name is not reduced to a letter", "Rahim", "initial", "Rahim"],
  ["a third token is dropped", "Md Rahim Uddin Ahmed", "initial", "Md R."],
  ["a phone number in the name box is refused", "01712345678", "initial", "Someone"],
  ["an empty name is refused", "   ", "first_name", "Someone"],
  ["a missing name is refused", null, "initial", "Someone"],
  ["Bangla is left alone", "রহিম উদ্দিন", "first_name", "রহিম"]
];

for (const [label, input, display, expected] of names) {
  const actual = redactBuyerName(input, display);

  check(label, actual === expected, `got "${actual}", expected "${expected}"`);
}

const long = redactBuyerName("Abdurrahmanibnkhaldunalmuqaddimah Ahmed", "first_name");

check("an over-long first name is cut", long.length <= 24, `${long.length} characters`);

console.log("\n=== Location redaction ===");

const places: Array<[string, string | null, string | null, string | null]> = [
  ["the city wins over the district", "Dhaka", "Dhaka District", "Dhaka"],
  ["the district is the fallback", null, "Chattogram", "Chattogram"],
  ["only the first comma segment is used", "Dhaka, Bangladesh", null, "Dhaka"],
  ["an address typed into the city box falls through", "House 12, Road 4", "Dhaka", "Dhaka"],
  ["a numeric city is refused", "1207", null, null],
  ["nothing at all is null", null, null, null],
  ["blank strings are null", "  ", "", null]
];

for (const [label, city, district, expected] of places) {
  const actual = resolveLocation(city, district);

  check(label, actual === expected, `got ${JSON.stringify(actual)}`);
}

console.log("\n=== Provenance: a card is a real order or it does not exist ===");

check(
  "the buyer line is built from the order row",
  stripComments(source.service).includes("redactBuyerName(row.order.customerName")
);

check(
  "the product is re-read from the catalogue, not quoted from the order line",
  stripComments(source.service).includes("product?.title ?? row.title")
);

check(
  "the seller's chosen statuses are what the query filters on",
  /status:\s*\{\s*in:\s*input\.orderStatuses\s*\}/.test(stripComments(source.repository))
);

check(
  "restricting to on-sale products uses the storefront's own product predicate",
  stripComments(source.repository).includes(
    "input.requirePublicProduct ? { product: publicProductWhere(input.storeId) } : {}"
  )
);

check(
  // The seller can widen the statuses as far as they like; this one is not a
  // setting, because a fake-marked order is the shop's own record that the
  // purchase never happened.
  "orders marked fake are excluded, and it is not a setting",
  stripComments(source.repository).includes("markedFakeAt: null") &&
    !stripComments(source.schema).includes("markedFake")
);

check(
  "a product that is no longer public gets no link",
  stripComments(source.service).includes("href: isPublic ?")
);

check(
  // Re-reading a hidden product's *current* title would publish something the
  // seller unpublished; the order line's snapshot is what was actually sold.
  "a product that is no longer public keeps the name it was sold under",
  stripComments(source.service).includes("productTitle: isPublic ? product.title : row.title")
);

check(
  "public and non-public are told apart by the one shared definition",
  stripComments(source.service).includes("publicProductWhere(input.storeId)") &&
    stripComments(source.service).includes("product?.status === publicProduct.status")
);

check(
  // The dashboard needs something to draw a preview with before the shop has
  // taken an order. Nothing on the storefront path may reach for it.
  "the dashboard's example card cannot reach a storefront file",
  source.console.includes("EXAMPLE_SAMPLE") && !storefrontSource.includes("EXAMPLE_SAMPLE")
);

check(
  "a shop with no qualifying order renders nothing",
  stripComments(source.dock).includes("events.length === 0")
);

console.log("\n=== Nothing private leaves the server ===");

for (const column of [
  "customerPhone",
  "customerEmail",
  "totalAmount",
  "shippingArea",
  "shippingAddressId",
  "ipAddress",
  "orderNumber"
]) {
  check(
    `\`${column}\` is named nowhere on the storefront path`,
    !storefrontSource.includes(column)
  );
}

check(
  "the event type carries no money",
  !stripComments(source.schema).includes("amount") &&
    !stripComments(source.schema).includes("price")
);

console.log("\n=== The gate ===");

check("only a manager may save", stripComments(source.actions).includes("requireStoreManager()"));

check(
  // The hole this is written against: storing the `true` anyway and merely
  // reporting the plan, which goes live the moment the store is entitled again.
  "switching the widget ON is refused by the plan, in the action that writes",
  /if \(input\.enabled\) \{\s*await requirePlanFeature\(store\.id, "sales_notifications"\);/.test(
    stripComments(source.actions)
  )
);

check(
  // The line coupons, bundles and the shopping agent also draw: a lapsed store
  // must always be able to stop something running on its own storefront.
  "switching it OFF is not gated",
  !stripComments(source.actions).includes(
    'await requirePlanFeature(store.id, "sales_notifications");\n    const settings'
  )
);

check(
  "the storefront re-checks the plan rather than trusting the stored switch",
  stripComments(source.dock).includes('hasPlanFeature(store.id, "sales_notifications")')
);

check(
  "a refused save opens the upgrade dialog rather than printing a red box",
  source.actions.includes("lockedFeature: error.featureKey") &&
    source.console.includes("openUpgrade(state.lockedFeature)")
);

console.log("\n=== Wiring ===");

const layout = readFileSync(
  join(process.cwd(), "apps", "web", "src", "app", "storefront", "[slug]", "layout.tsx"),
  "utf8"
);

check("the storefront layout mounts the dock once", layout.includes("<SalesNotificationDock"));

const prismaSchema = readFileSync(
  join(process.cwd(), "packages", "db", "prisma", "schema.prisma"),
  "utf8"
);

check(
  "the settings model is in schema.prisma",
  prismaSchema.includes("model StoreSalesNotificationSetting")
);

check(
  "the model and the runtime DDL agree that it is off by default",
  /enabled\s+Boolean\s+@default\(false\)/.test(prismaSchema) &&
    source.repository.includes('"enabled" BOOLEAN NOT NULL DEFAULT false')
);

const statusDefault = SALES_NOTIFICATION_DEFAULTS.orderStatuses.join(",");

check(
  "the model, the DDL and the code agree on the default status set",
  prismaSchema.includes(`@default("${statusDefault}")`) &&
    source.repository.includes(`DEFAULT '${statusDefault}'`)
);

check(
  // `CREATE TABLE IF NOT EXISTS` is a no-op on a database that already has the
  // table, so a column added afterwards needs its own idempotent statement.
  "columns added after the table shipped have their own ALTER",
  source.repository.includes('ADD COLUMN IF NOT EXISTS "orderStatuses"') &&
    source.repository.includes('ADD COLUMN IF NOT EXISTS "requirePublicProduct"')
);

const marketingOverview = readFileSync(
  join(process.cwd(), "apps", "web", "src", "app", "dashboard", "marketing", "page.tsx"),
  "utf8"
);
const nav = readFileSync(
  join(process.cwd(), "apps", "web", "src", "components", "dashboard", "dashboard-nav.tsx"),
  "utf8"
);

check(
  "the sidebar links to it",
  nav.includes('{ href: "/dashboard/marketing/sales-notifications", label: "Sales Notifications" }')
);

check(
  "the sidebar badges it with its own plan key",
  nav.includes('"/dashboard/marketing/sales-notifications": "sales_notifications"')
);

check(
  "the Marketing overview page has a card for it",
  marketingOverview.includes('href="/dashboard/marketing/sales-notifications"')
);

console.log("\n=== The shopper's side of it ===");

check(
  "closing a card stops the rest for that visit",
  source.feed.includes("sessionStorage.setItem(dismissKey(storeSlug)")
);

check("hovering pauses the queue", source.feed.includes("onMouseEnter"));

check("a hidden tab pauses the queue", source.feed.includes("visibilitychange"));

check(
  "the queue stops on its own",
  source.feed.includes("shown >= options.maxPerSession") && source.feed.includes('kind: "done"')
);

check(
  "the card is not announced over a screen reader's own work",
  // Stripped, because the comment above the dock explains at length why there
  // is no `aria-live` here.
  !stripComments(source.feed).includes("aria-live") &&
    source.card.includes('aria-label="Hide purchase')
);

console.log(
  failures === 0
    ? "\nSales Notifications: all checks passed."
    : `\nSales Notifications: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);
