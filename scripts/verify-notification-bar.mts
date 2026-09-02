/**
 * Floating Notification Bar check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * storefront's announcement bar, and — like `verify-sales-notifications.mts` —
 * it is deliberately the half that needs neither a database nor a session.
 *
 * Three things are worth checking and two of them are the whole feature.
 *
 * The *honesty* checks are the first. A countdown is a claim about the world,
 * and the way these widgets normally lie is the evergreen timer: a duration
 * added to whenever the shopper happened to arrive, so everyone is told they
 * have four hours left, forever. This module counts to one stored timestamp and
 * has nowhere to put a duration, and that is asserted rather than trusted — the
 * deadline is passed straight through, the same field is the bar's own last
 * moment, and a bar whose end has passed is refused at save and produces no
 * markup at render.
 *
 * The *safety* checks are the second. `ctaHref` is seller-typed text that
 * becomes an anchor on a page every shopper loads, so `isSafeBarHref` is driven
 * across the shapes an attacker or a typo actually produces: `javascript:`, a
 * scheme with a tab inside it, the protocol-relative `//host` that reads like a
 * path, and the backslash variant browsers also accept. It is enforced in the
 * schema, so an unsafe href cannot be *stored* rather than merely not rendered.
 *
 * The *gate* checks assert the plan is enforced in the action that writes, that
 * switching the bar **off** is not gated, and that the storefront re-checks the
 * plan rather than trusting a stored `true`.
 *
 * Covers:
 * - the feature key registered, and granted from Starter up;
 * - the settings schema's bounds, enums and cross-field rules, including
 *   FormData's strings;
 * - defaults being off, at the bottom, and in the shop's own colours;
 * - the countdown's arithmetic, its floor at zero, and the deadline instant
 *   counting as ended rather than open;
 * - one field being both the countdown target and the bar's last moment;
 * - link safety across the shapes that get past a naive prefix test;
 * - base-path prefixing, and `noopener` on the links that leave the shop;
 * - a dismissal being scoped to the announcement it was made about;
 * - the view refusing to publish a disabled, empty, scheduled or finished bar;
 * - the plan enforced on enable, ungated on disable, re-checked on render;
 * - the storefront layout mounting the dock, and the model matching the DDL.
 *
 * Run with: npm run verify:notification-bar
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PLAN_CATALOG, isPaidFeature } from "../apps/web/src/modules/admin/plan-catalog";
import { PLAN_FEATURE_KEYS } from "../apps/web/src/modules/billing/plan-features";
import {
  barAppearsAt,
  barRevision,
  barWindowState,
  buildNotificationBarView,
  countdownParts,
  isSafeBarHref,
  padCountdown,
  resolveBarLink
} from "../apps/web/src/modules/notification-bar/notification-bar.render";
import {
  NOTIFICATION_BAR_DEFAULTS,
  NOTIFICATION_BAR_HOME_SLOTS,
  NOTIFICATION_BAR_PRODUCT_SLOTS,
  NOTIFICATION_BAR_SHOP_SLOTS,
  NOTIFICATION_BAR_SURFACES,
  notificationBarSettingsSchema,
  type NotificationBarSettings
} from "../apps/web/src/modules/notification-bar/notification-bar.schema";

const globalsCss = readFileSync(
  join(process.cwd(), "apps", "web", "src", "app", "globals.css"),
  "utf8"
);

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

const MODULE_DIR = join(process.cwd(), "apps", "web", "src", "modules", "notification-bar");

function read(file: string) {
  return readFileSync(join(MODULE_DIR, file), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks below that assert a name is *absent* — "evergreen", a second
 * deadline column — have to read the code, because the doc comments name both
 * while explaining why neither exists.
 */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const source = {
  actions: read("notification-bar.actions.ts"),
  bar: read(join("components", "notification-bar.tsx")),
  console: read(join("components", "notification-bar-console.tsx")),
  dock: read(join("components", "notification-bar-dock.tsx")),
  render: read("notification-bar.render.ts"),
  repository: read("notification-bar.repository.ts"),
  schema: read("notification-bar.schema.ts"),
  slot: read(join("components", "notification-bar-slot.tsx")),
  service: read("notification-bar.service.ts")
};

/**
 * The clock every check below is written against.
 *
 * The real one, not a fixed date: the schema refuses to *publish* a bar whose
 * deadline has already passed, and it reads `Date.now()` to decide that — so a
 * fixture pinned to a literal date would start failing the day it went stale,
 * which is the least useful kind of failing check. Everything here is an offset
 * from this, so the arithmetic stays exact while the calendar moves.
 */
const HOUR = 60 * 60 * 1000;
const NOW = Date.now();

function settings(patch: Partial<NotificationBarSettings> = {}): NotificationBarSettings {
  return { ...NOTIFICATION_BAR_DEFAULTS, ...patch };
}

/** A bar that would publish, so each check below can spoil exactly one thing. */
function publishable(patch: Partial<NotificationBarSettings> = {}) {
  return settings({
    ctaHref: "/products",
    ctaLabel: "Shop now",
    enabled: true,
    endsAt: new Date(NOW + 48 * HOUR).toISOString(),
    headline: "20% OFF",
    ...patch
  });
}

console.log("=== Entitlement ===");

check(
  "`notification_bar` is a registered feature key",
  PLAN_FEATURE_KEYS.includes("notification_bar")
);

const grantedBy = PLAN_CATALOG.filter((plan) => plan.features.includes("notification_bar"))
  .map((plan) => plan.slug)
  .sort();

check(
  "the key is granted from Starter up",
  grantedBy.join(",") === "growth,pro,starter",
  grantedBy.join(", ") || "no plan grants it"
);

check("it is a paid feature", isPaidFeature("notification_bar"));

console.log("\n=== Defaults ===");

check(
  "the defaults parse",
  notificationBarSettingsSchema.safeParse(NOTIFICATION_BAR_DEFAULTS).success
);

check(
  // An entitled plan must never publish something on a seller's storefront by
  // itself. The same rule Sales Notifications and the Shopping Agent follow.
  "the bar is off until a seller asks for it",
  NOTIFICATION_BAR_DEFAULTS.enabled === false
);

check(
  // The top of a storefront already carries the announcement strip, the header
  // and the menu; a bar over them covers what people came for.
  "it sits at the bottom by default",
  NOTIFICATION_BAR_DEFAULTS.position === "bottom"
);

check(
  "the bar colour is the shop's own until a seller picks one",
  NOTIFICATION_BAR_DEFAULTS.backgroundColor === ""
);

check("there is no headline to publish by default", NOTIFICATION_BAR_DEFAULTS.headline === "");

check("shoppers can close it by default", NOTIFICATION_BAR_DEFAULTS.dismissible === true);

console.log("\n=== The countdown counts to a real moment ===");

const twoDays = countdownParts(NOW + 2 * 86400_000 + 3 * HOUR + 4 * 60_000 + 5000, NOW);

check(
  "days, hours, minutes and seconds are split out",
  twoDays.days === 2 && twoDays.hours === 3 && twoDays.minutes === 4 && twoDays.seconds === 5,
  JSON.stringify(twoDays)
);

const passed = countdownParts(NOW - 5000, NOW);

check(
  // A frame rendered on the way to zero must not read "-1".
  "a deadline that has passed is all zeros, never negative",
  passed.days === 0 &&
    passed.hours === 0 &&
    passed.minutes === 0 &&
    passed.seconds === 0 &&
    passed.totalMs === 0
);

check(
  "an unreadable deadline is zero rather than NaN",
  countdownParts(Number.NaN, NOW).totalMs === 0
);

check(
  "digits are padded the way a clock reads",
  padCountdown(4) === "04" && padCountdown(48) === "48"
);

check("a three-digit day count is not truncated", padCountdown(120) === "120");

const window = {
  endsAt: new Date(NOW + HOUR).toISOString(),
  startsAt: new Date(NOW - HOUR).toISOString()
};

check("a bar inside its window is open", barWindowState(window, NOW) === "open");
check(
  "a bar before its start is scheduled",
  barWindowState(window, NOW - 2 * HOUR) === "scheduled"
);
check("a bar after its end has ended", barWindowState(window, NOW + 2 * HOUR) === "ended");

check(
  // The same instant the countdown reads all zeros. Anything else is a bar
  // still promising a discount whose timer has run out.
  "the deadline instant itself counts as ended",
  barWindowState(window, NOW + HOUR) === "ended"
);

check(
  "a bar with no dates is simply open",
  barWindowState({ endsAt: null, startsAt: null }, NOW) === "open"
);

check(
  // The rule the whole module is arranged around: one column is the countdown
  // target and the bar's last moment, so the two can never disagree.
  "there is only one deadline field, and it is `endsAt`",
  !stripComments(source.schema).includes("countdownEndsAt") &&
    !stripComments(source.schema).includes("expiresAt") &&
    !stripComments(source.repository).includes("countdownEndsAt")
);

check(
  "the view passes the stored deadline straight through",
  stripComments(source.render).includes("endsAt: settings.endsAt")
);

check(
  // An evergreen timer needs a duration added to the shopper's arrival. There is
  // nowhere in this module to store one, and no name for one either.
  "there is no evergreen timer anywhere in the module",
  !/evergreen|durationMinutes|resetEvery|restartAfter/i.test(
    stripComments([source.schema, source.render, source.service, source.repository].join("\n"))
  )
);

console.log("\n=== A seller-typed link on a public page ===");

const hrefs: Array<[string, string, boolean]> = [
  ["a storefront path", "/products", true],
  ["a deep path", "/collections/eid/sale", true],
  ["an in-page anchor", "#offers", true],
  ["an https address", "https://example.com/sale", true],
  ["a phone number", "tel:+8801700000000", true],
  ["a mail address", "mailto:shop@example.com", true],
  ["javascript:", "javascript:alert(1)", false],
  ["JavaScript: in mixed case", "JaVaScRiPt:alert(1)", false],
  ["a data URL", "data:text/html,<script>alert(1)</script>", false],
  ["vbscript:", "vbscript:msgbox(1)", false],
  ["a protocol-relative host that reads like a path", "//evil.example/sale", false],
  ["the backslash variant of it", "/\\evil.example", false],
  ["a bare hostname", "evil.example", false],
  ["an empty destination", "", false],
  ["whitespace only", "   ", false],
  ["a bare anchor with nothing after it", "#", false]
];

for (const [label, href, expected] of hrefs) {
  check(`${label} is ${expected ? "allowed" : "refused"}`, isSafeBarHref(href) === expected, href);
}

// A tab inside the scheme is stripped by the browser and not by `startsWith`.
check(
  "a scheme with a control character inside it is refused",
  !isSafeBarHref(`java${String.fromCharCode(9)}script:alert(1)`)
);

check("an absurdly long destination is refused", !isSafeBarHref(`/${"a".repeat(600)}`));

check(
  // One stored `/products` has to be right on a subdomain, on a custom domain,
  // and on the `/s/<slug>` path form.
  "a relative destination is prefixed with the storefront's base path",
  resolveBarLink("/s/ds-shop", "/products")?.href === "/s/ds-shop/products"
);

check(
  "on a shop's own address the same destination is left clean",
  resolveBarLink("", "/products")?.href === "/products"
);

check(
  "a link that leaves the shop opens in a new tab",
  resolveBarLink("", "https://example.com")?.newTab === true
);

check(
  // A phone number opening a tab is not useful to anybody.
  "a phone number does not open a new tab",
  resolveBarLink("", "tel:+8801700000000")?.newTab === false
);

check(
  "an unsafe destination resolves to nothing",
  resolveBarLink("", "javascript:alert(1)") === null
);

check(
  "a link that opens a tab carries noopener",
  source.bar.includes('rel: "noopener noreferrer", target: "_blank"')
);

console.log("\n=== A dismissal is about one announcement ===");

const base = publishable();
const revision = barRevision(base);

check("the revision is a short, stable fingerprint", /^[0-9a-z]{7,8}$/.test(revision), revision);

check("the same bar fingerprints the same twice", barRevision(publishable()) === revision);

check(
  // Otherwise a seller's next campaign is invisible to everyone who closed the
  // last one.
  "a new headline is a new announcement",
  barRevision(publishable({ headline: "50% OFF" })) !== revision
);

check(
  "a new deadline is a new announcement",
  barRevision(publishable({ endsAt: null })) !== revision
);

check(
  // Re-showing the bar to everyone who closed it over a style change is the
  // widget nagging, not announcing.
  "recolouring or moving the bar is not a new announcement",
  barRevision(publishable({ backgroundColor: "#ff0000", position: "top" })) === revision
);

check(
  "moving a character between two fields changes the fingerprint",
  barRevision(publishable({ ctaLabel: "Shop", headline: "20% OFF now" })) !==
    barRevision(publishable({ ctaLabel: "now Shop", headline: "20% OFF" }))
);

check(
  "the dismissal is filed under the revision, not the store alone",
  source.bar.includes("storeim.notification-bar.${storeSlug}.${revision}")
);

console.log("\n=== What the storefront is allowed to publish ===");

check(
  "a switched-off bar publishes nothing",
  buildNotificationBarView({
    basePath: "",
    nowMs: NOW,
    settings: publishable({ enabled: false })
  }) === null
);

check(
  "a bar with no headline publishes nothing",
  buildNotificationBarView({
    basePath: "",
    nowMs: NOW,
    settings: publishable({ headline: "" })
  }) === null
);

check(
  // A sale that opens next Friday is a thing sellers plan around; it must not be
  // readable in this Friday's page source.
  "a bar whose start has not arrived publishes no markup at all",
  buildNotificationBarView({
    basePath: "",
    nowMs: NOW,
    settings: publishable({ startsAt: new Date(NOW + HOUR).toISOString() })
  }) === null
);

check(
  "a bar whose deadline has passed publishes nothing",
  buildNotificationBarView({
    basePath: "",
    nowMs: NOW,
    settings: publishable({ endsAt: new Date(NOW - HOUR).toISOString() })
  }) === null
);

const view = buildNotificationBarView({
  basePath: "/s/ds-shop",
  nowMs: NOW,
  settings: publishable()
});

check("an open bar publishes", view !== null);
check("its button points at the base-path form", view?.cta?.href === "/s/ds-shop/products");

check(
  "a destination this module will not publish leaves no button",
  buildNotificationBarView({
    basePath: "",
    nowMs: NOW,
    settings: publishable({ ctaHref: "javascript:alert(1)" })
  })?.cta === null
);

check(
  "a button with no words is no button",
  buildNotificationBarView({ basePath: "", nowMs: NOW, settings: publishable({ ctaLabel: "" }) })
    ?.cta === null
);

check(
  "a bar with no deadline shows no countdown",
  buildNotificationBarView({
    basePath: "",
    nowMs: NOW,
    settings: publishable({ endsAt: null, showCountdown: true })
  })?.showCountdown === false
);

check(
  // The deadline is the offer's end, not the timer's decoration.
  "a hidden countdown still takes the bar down at its deadline",
  stripComments(source.bar).includes("remaining.totalMs <= 0") &&
    !stripComments(source.bar).includes("showCountdown && remaining !== null && remaining.totalMs")
);

console.log("\n=== Settings bounds ===");

const bad: Array<[string, Partial<NotificationBarSettings>]> = [
  ["a 61-character headline", { headline: "x".repeat(61) }],
  ["a 121-character supporting line", { message: "x".repeat(121) }],
  ["a 29-character button", { ctaLabel: "x".repeat(29) }],
  ["a 91-day dismissal", { dismissDays: 91 }],
  ["a negative dismissal", { dismissDays: -1 }],
  ["an unknown position", { position: "middle" as NotificationBarSettings["position"] }],
  ["an unknown shape", { layout: "banner" as NotificationBarSettings["layout"] }],
  ["a colour that is not a colour", { backgroundColor: "red" }],
  ["an unreadable date", { endsAt: "next tuesday" }]
];

for (const [label, patch] of bad) {
  check(
    `${label} is refused`,
    !notificationBarSettingsSchema.safeParse({ ...NOTIFICATION_BAR_DEFAULTS, ...patch }).success
  );
}

const cross: Array<[string, NotificationBarSettings]> = [
  ["publishing with no headline", publishable({ headline: "" })],
  ["a button with nowhere to go", publishable({ ctaHref: "javascript:alert(1)" })],
  ["a button with nowhere to go at all", publishable({ ctaHref: "" })],
  ["a destination with no button", publishable({ ctaLabel: "" })],
  ["publishing a countdown with no deadline", publishable({ endsAt: null, showCountdown: true })],
  [
    "a bar that ends before it starts",
    publishable({
      endsAt: new Date(NOW + HOUR).toISOString(),
      startsAt: new Date(NOW + 2 * HOUR).toISOString()
    })
  ],
  [
    // The rule enforced at the one moment it can be.
    "publishing a bar whose deadline is already behind it",
    publishable({ endsAt: new Date(NOW - HOUR).toISOString() })
  ]
];

for (const [label, value] of cross) {
  check(`${label} is refused`, !notificationBarSettingsSchema.safeParse(value).success);
}

check(
  // A draft is not a publication: refusing to save one because its date has
  // passed would leave a seller unable to edit their way out of it.
  "a switched-off bar with a stale deadline still saves",
  notificationBarSettingsSchema.safeParse(
    publishable({ enabled: false, endsAt: new Date(NOW - HOUR).toISOString() })
  ).success
);

check(
  "a bar with no deadline at all is allowed to run until it is switched off",
  notificationBarSettingsSchema.safeParse(publishable({ endsAt: null, showCountdown: false }))
    .success
);

// The console posts through FormData, so numbers and blank dates arrive as strings.
const fromForm = notificationBarSettingsSchema.safeParse({
  ...publishable(),
  dismissDays: "7",
  startsAt: ""
});

check(
  "a number submitted as a string is coerced, and a blank date is null",
  fromForm.success && fromForm.data.dismissDays === 7 && fromForm.data.startsAt === null,
  fromForm.success ? "" : fromForm.error.issues[0]?.message
);

check(
  "an upper-case or three-digit hex colour is accepted",
  notificationBarSettingsSchema.safeParse(publishable({ backgroundColor: "#2F6BFF" })).success &&
    notificationBarSettingsSchema.safeParse(publishable({ backgroundColor: "#abc" })).success
);

console.log("\n=== Placement: which page, and where on it ===");

check(
  // The first release published a shop-wide floating bar and nothing else, so a
  // store that saved settings before placement existed must go on behaving
  // exactly as it did. That is what makes these six columns additive.
  "the default is the shop-wide floating bar the first release published",
  NOTIFICATION_BAR_DEFAULTS.display === "overlay" &&
    NOTIFICATION_BAR_SURFACES.every((surface) =>
      NOTIFICATION_BAR_DEFAULTS.surfaces.includes(surface)
    )
);

const inline = publishable({ display: "inline", surfaces: ["home", "shop", "product"] });
const inlineView = buildNotificationBarView({ basePath: "", nowMs: NOW, settings: inline });

check("an inline bar publishes", inlineView !== null);

check(
  // Otherwise a seller switching to a floating bar would get two of them: one
  // from the layout's dock and one from whichever anchor still matched.
  "an overlay never matches an inline anchor",
  NOTIFICATION_BAR_HOME_SLOTS.every(
    (anchor) => barAppearsAt({ ...inline, display: "overlay" }, "home", anchor) === false
  )
);

check(
  "the seller's home anchor is the only home anchor that matches",
  NOTIFICATION_BAR_HOME_SLOTS.filter((anchor) => barAppearsAt(inline, "home", anchor)).join(",") ===
    inline.homeSlot
);

check(
  "the seller's shop anchor is the only shop anchor that matches",
  NOTIFICATION_BAR_SHOP_SLOTS.filter((anchor) => barAppearsAt(inline, "shop", anchor)).join(",") ===
    inline.shopSlot
);

check(
  "the seller's product anchor is the only product anchor that matches",
  NOTIFICATION_BAR_PRODUCT_SLOTS.filter((anchor) => barAppearsAt(inline, "product", anchor)).join(
    ","
  ) === inline.productSlot
);

check(
  // The reason a seller will be looking, so it is checked before the anchor.
  "a page the seller did not tick shows nothing, at any anchor",
  NOTIFICATION_BAR_PRODUCT_SLOTS.every(
    (anchor) => barAppearsAt({ ...inline, surfaces: ["home"] }, "product", anchor) === false
  )
);

check(
  // There is no slot vocabulary for a page this module knows nothing about, so
  // the top of the content is the one place that exists on all of them.
  "every other storefront page takes the bar at the top and nowhere else",
  barAppearsAt({ ...inline, surfaces: ["other"] }, "other", "top") &&
    !barAppearsAt({ ...inline, surfaces: ["other"] }, "other", "before_footer") &&
    !barAppearsAt({ ...inline, surfaces: ["other"] }, "other", "below_cart")
);

check(
  "the view carries the placement through to the browser",
  inlineView?.display === "inline" &&
    inlineView.homeSlot === inline.homeSlot &&
    inlineView.shopSlot === inline.shopSlot &&
    inlineView.productSlot === inline.productSlot &&
    inlineView.gridAfter === inline.gridAfter
);

const placementBad: Array<[string, Partial<NotificationBarSettings>]> = [
  ["an unknown display mode", { display: "banner" as NotificationBarSettings["display"] }],
  ["an unknown home anchor", { homeSlot: "middle" as NotificationBarSettings["homeSlot"] }],
  ["an unknown shop anchor", { shopSlot: "sidebar" as NotificationBarSettings["shopSlot"] }],
  [
    "an unknown product anchor",
    { productSlot: "gallery" as NotificationBarSettings["productSlot"] }
  ],
  ["an unknown page", { surfaces: ["blog"] as unknown as NotificationBarSettings["surfaces"] }],
  // An inline bar with no page to sit on is switched on and can never appear,
  // which reads as broken rather than as off.
  ["no pages at all", { surfaces: [] }],
  ["a bar after zero products", { gridAfter: 0 }],
  ["a bar after 25 products", { gridAfter: 25 }]
];

for (const [label, patch] of placementBad) {
  check(
    `${label} is refused`,
    !notificationBarSettingsSchema.safeParse(publishable(patch)).success
  );
}

check(
  "pages submitted as one comma-separated field are parsed and de-duplicated",
  (() => {
    const parsed = notificationBarSettingsSchema.safeParse({
      ...publishable(),
      gridAfter: "6",
      surfaces: ["home", "product", "home"]
    });

    return (
      parsed.success &&
      parsed.data.gridAfter === 6 &&
      parsed.data.surfaces.join(",") === "home,product"
    );
  })()
);

console.log("\n=== Placement: the anchors exist where they are claimed ===");

const storefrontApp = join(process.cwd(), "apps", "web", "src", "app", "storefront", "[slug]");
const templatesDir = join(
  process.cwd(),
  "apps",
  "web",
  "src",
  "modules",
  "storefront",
  "templates"
);

function readFile(...parts: string[]) {
  return readFileSync(join(...parts), "utf8");
}

/** Every `page.tsx` under a route tree, so a new route cannot go unchecked. */
function walkRoutes(dir: string, found: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      walkRoutes(full, found);
    } else if (entry.name === "page.tsx") {
      found.push(full);
    }
  }

  return found;
}

const homePage = readFile(storefrontApp, "page.tsx");
const shopPage = readFile(storefrontApp, "products", "page.tsx");
const productPage = readFile(storefrontApp, "products", "[productSlug]", "page.tsx");
const productTemplate = readFile(templatesDir, "general-default", "product-page.tsx");
const productGrid = readFile(
  process.cwd(),
  "apps",
  "web",
  "src",
  "modules",
  "storefront",
  "components",
  "product-listing.tsx"
);

/**
 * Every anchor a seller can choose has to exist in the storefront, or the
 * setting is a control that saves and does nothing — the exact failure this
 * codebase calls "saved-and-ignored" elsewhere. Checked by reading the files
 * rather than by rendering them, so the check still needs no database.
 */
const placements: Array<[string, string, string]> = [
  ["home / above everything", homePage, 'anchor="top" store={store} surface="home"'],
  ["home / above the footer", homePage, 'anchor="before_footer" store={store} surface="home"'],
  ["shop / above the page title", shopPage, 'anchor="top" store={store} surface="shop"'],
  ["shop / above the products", shopPage, 'anchor="above_grid" store={store} surface="shop"'],
  ["shop / inside the grid", shopPage, 'anchor="in_grid" store={store} surface="shop"'],
  ["shop / below the products", shopPage, 'anchor="before_footer" store={store} surface="shop"'],
  ["product / above everything", productPage, 'anchor="top" store={store} surface="product"'],
  [
    "product / under the whole product",
    productPage,
    'anchor="below_details" store={store} surface="product"'
  ],
  [
    "product / above Add to Cart",
    productTemplate,
    'anchor="above_cart" store={store} surface="product"'
  ],
  [
    "product / below Add to Cart",
    productTemplate,
    'anchor="below_cart" store={store} surface="product"'
  ]
];

for (const [label, file, marker] of placements) {
  check(`the ${label} anchor is rendered`, file.includes(marker));
}

// The home page's other two anchors are per-template: each file is the only one
// that knows where its own hero ends, so all four have to carry them or a
// seller's choice would silently do nothing on three of the templates.
for (const template of [
  "general-default",
  "beauty-default",
  "electronics-default",
  "fashion-default"
]) {
  const sections = readFile(templatesDir, template, "homepage-sections.tsx");

  check(
    `${template} places the two home anchors only a template can place`,
    sections.includes('anchor="after_hero" store={store} surface="home"') &&
      sections.includes('anchor="after_first_section" store={store} surface="home"')
  );
}

/**
 * "Everywhere else" has to mean everywhere else.
 *
 * A seller ticking a page and getting nothing is the saved-and-ignored failure
 * this file exists to catch, and it is the easy one to introduce: a storefront
 * route added later renders its own header and quietly falls outside the
 * setting. So every page that draws `StorefrontHeader` must also carry the
 * anchor — the check walks the route tree rather than naming the pages, which
 * is what makes a new route fail here instead of on a shopper's screen.
 */
const otherSurfacePages = walkRoutes(storefrontApp).filter((file) => {
  const relative = file.slice(storefrontApp.length + 1).replaceAll("\\", "/");

  // The three surfaces with slot vocabularies of their own are checked above.
  return (
    relative !== "page.tsx" &&
    relative !== "products/page.tsx" &&
    relative !== "products/[productSlug]/page.tsx"
  );
});

for (const file of otherSurfacePages) {
  const contents = readFileSync(file, "utf8");

  if (!contents.includes("<StorefrontHeader store={store} />")) {
    continue;
  }

  check(
    `${file.slice(storefrontApp.length + 1).replaceAll("\\", "/")} carries the "everywhere else" anchor`,
    contents.includes('anchor="top" store={store} surface="other"')
  );
}

check(
  // An `in_grid` bar is a *cell*: a slot that rendered nothing would still take
  // a column, so the page asks first and passes null rather than an element.
  "the shop page decides the grid cell rather than leaving an empty one",
  shopPage.includes('barAppearsAt(notificationBar, "shop", "in_grid")') &&
    shopPage.includes("barInGrid === null ? null : (")
);

check(
  "the grid places the bar after the card, spanning every column",
  productGrid.includes("slotIndex === index + 1") &&
    productGrid.includes('className="sf-grid-slot"')
);

check(
  // A bar set to appear after twelve products on a page showing eight would
  // otherwise vanish, and "after the last one" is the honest reading of it.
  "a bar placed past the end of the page falls to the last card",
  productGrid.includes("Math.min(Math.max(1, inlineSlotAfter), visible.length)")
);

check(
  // Two bars on one page is the failure mode of having two mounting points.
  "the layout's dock renders only the overlay",
  stripComments(source.dock).includes('bar.display !== "overlay"')
);

check(
  "every anchor asks the one shared placement function",
  stripComments(source.slot).includes("barAppearsAt(bar, surface, anchor)")
);

check(
  // Twelve anchors on a page, at most one bar. Without request memoisation that
  // would be twelve settings reads and twelve plan lookups.
  "the resolver is request-cached so scattering anchors stays cheap",
  stripComments(source.service).includes("cache(async function resolveNotificationBar")
);

check(
  // An unrendered slot leaves no trace, so a competitor reading the HTML learns
  // nothing about where a shop would put an offer or whether one is scheduled.
  "an anchor that does not match leaves nothing in the page source",
  /if \(!bar \|\| !barAppearsAt\(bar, surface, anchor\)\) \{\s*return null;/.test(
    stripComments(source.slot)
  )
);

check(
  "a bottom overlay lifts the corner widgets, and an inline bar does not",
  globalsCss.includes('body:has(.nb-dock[data-display="overlay"][data-position="bottom"])') &&
    !globalsCss.includes('body:has(.nb-dock[data-position="bottom"])')
);

check(
  "an inline bar is in the flow rather than pinned to the viewport",
  globalsCss.includes('.nb-dock[data-display="inline"]') &&
    /\.nb-dock\[data-display="inline"\][^{]*\{[^}]*position: static/.test(globalsCss)
);

console.log("\n=== The gate ===");

check("only a manager may save", stripComments(source.actions).includes("requireStoreManager()"));

check(
  // The hole this is written against: storing the `true` anyway and merely
  // reporting the plan, which goes live the moment the store is entitled again.
  "switching the bar ON is refused by the plan, in the action that writes",
  /if \(input\.enabled\) \{\s*await requirePlanFeature\(store\.id, "notification_bar"\);/.test(
    stripComments(source.actions)
  )
);

check(
  // The line coupons, bundles, the shopping agent and sales notifications also
  // draw: a lapsed store must always be able to take down something running on
  // its own storefront.
  "switching it OFF is not gated",
  // Counted with the parenthesis, so the import at the top of the file is not
  // mistaken for a second gate.
  (stripComments(source.actions).match(/requirePlanFeature\(/g) ?? []).length === 1
);

check(
  // In the shared resolver rather than in each mounting point, so the layout's
  // dock and all twelve inline anchors are gated by one read: a second copy in
  // the slot is a second copy that could be deleted without anything failing.
  "the storefront re-checks the plan rather than trusting the stored switch",
  /resolveNotificationBar[\s\S]*?hasPlanFeature\(store\.id, "notification_bar"\)/.test(
    stripComments(source.service)
  ) &&
    stripComments(source.dock).includes("resolveNotificationBar(store)") &&
    stripComments(source.slot).includes("resolveNotificationBar(store)")
);

check(
  "a refused save opens the upgrade dialog rather than printing a red box",
  source.actions.includes("lockedFeature: error.featureKey") &&
    source.console.includes("openUpgrade(state.lockedFeature)")
);

check(
  // The one thing a shopper's browser is trusted with is the clock and the X.
  "the browser is never sent a store id",
  !stripComments(source.schema).includes("storeId: string") && !source.bar.includes("storeId")
);

console.log("\n=== Wiring ===");

const layout = readFileSync(
  join(process.cwd(), "apps", "web", "src", "app", "storefront", "[slug]", "layout.tsx"),
  "utf8"
);

check("the storefront layout mounts the dock once", layout.includes("<NotificationBarDock"));

check(
  "the dashboard and the storefront render the same component",
  source.console.includes("<NotificationBar bar={previewBar} preview />") &&
    source.dock.includes("<NotificationBar bar={bar}")
);

const prismaSchema = readFileSync(
  join(process.cwd(), "packages", "db", "prisma", "schema.prisma"),
  "utf8"
);

check(
  "the settings model is in schema.prisma",
  prismaSchema.includes("model StoreNotificationBar")
);

check(
  "the model and the runtime DDL agree the bar is off by default",
  /model StoreNotificationBar[\s\S]*?enabled\s+Boolean\s+@default\(false\)/.test(prismaSchema) &&
    source.repository.includes('"enabled" BOOLEAN NOT NULL DEFAULT false')
);

check(
  "the model, the DDL and the code agree on where it sits",
  prismaSchema.includes(
    `position        String    @default("${NOTIFICATION_BAR_DEFAULTS.position}")`
  ) &&
    source.repository.includes(
      `"position" TEXT NOT NULL DEFAULT '${NOTIFICATION_BAR_DEFAULTS.position}'`
    )
);

check(
  "both timestamp columns are nullable in the model and the DDL",
  /startsAt\s+DateTime\?/.test(prismaSchema) &&
    /endsAt\s+DateTime\?/.test(prismaSchema) &&
    source.repository.includes('"startsAt" TIMESTAMP(3)') &&
    source.repository.includes('"endsAt" TIMESTAMP(3)')
);

const nav = readFileSync(
  join(process.cwd(), "apps", "web", "src", "components", "dashboard", "dashboard-nav.tsx"),
  "utf8"
);

check(
  "the dashboard link is badged from the same feature key",
  nav.includes('"/dashboard/marketing/notification-bar": "notification_bar"') &&
    nav.includes('href: "/dashboard/marketing/notification-bar"')
);

console.log(
  failures === 0
    ? "\nAll notification-bar checks passed."
    : `\n${failures} notification-bar check(s) FAILED.`
);

process.exit(failures === 0 ? 0 : 1);
