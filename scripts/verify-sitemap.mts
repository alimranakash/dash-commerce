/**
 * XML sitemap and robots.txt check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * crawler-facing surface, and — like `verify-shopping-agent.mts` — the half of
 * it that needs neither a database nor a request.
 *
 * Three layers are driven.
 *
 * The *document* checks render real `<urlset>` and `<sitemapindex>` documents
 * from fixture rows and read the XML back: element order, the image namespace
 * appearing only when something uses it, escaping, and slugs surviving
 * percent-encoding. A store with a category called `Tea & Coffee` produces
 * either a sitemap or a parse error, and the difference is one `&`.
 *
 * The *agreement* checks are the reason this file exists. A sitemap and a
 * robots.txt are two lists describing one decision, and they live in different
 * modules: every URL the sitemap submits must be one robots allows, and every
 * storefront route must be either submitted or disallowed on purpose. Adding
 * `app/storefront/[slug]/wishlist/` and forgetting the second list fails here
 * rather than in a search result.
 *
 * The *source* checks read the routes and the repository as text, the way
 * `verify-staff-permissions.mts` reads action modules: "the sitemap refuses
 * every host that serves no storefront" is true of the code or it
 * is not, whereas one call that happens to 404 proves nothing about the next.
 *
 * Covers:
 * - `<loc>`, `<lastmod>`, `<changefreq>` and `<priority>` in schema order, and
 *   the image extension declared only when a product has a photo;
 * - XML escaping and per-segment percent-encoding of seller-authored slugs;
 * - relative `/uploads/...` image keys becoming absolute, and `data:` URIs
 *   dropped rather than inlined;
 * - section names round-tripping through the index, and junk names refused
 *   instead of served as an empty document;
 * - the paging arithmetic that turns a product count into `products-N.xml`;
 * - the marketing sitemap carrying every docs page and no seller-app route;
 * - every URL the sitemap submits being crawlable under the same surface's
 *   robots.txt, and every storefront route being submitted, disallowed, or a
 *   known redirect;
 * - the reads being store-scoped and narrowed by `publicProductWhere`, so a
 *   DRAFT or HIDDEN product cannot be submitted;
 * - product paging ordering by creation rather than by edit, so a crawler does
 *   not lose rows between two fetches of one catalogue;
 * - the sitemap and robots routes refusing the seller app and any host that
 *   serves no store, while treating every store the storefront will render as
 *   one worth indexing;
 * - the `/s/` stubs re-exporting `generateMetadata`, without which every
 *   canonical tag the sitemap depends on silently stops rendering.
 *
 * Run with: npm run verify:sitemap
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { docsPages } from "../apps/web/src/modules/docs/docs-content";
import {
  MARKETING_DISALLOWED_PATHS,
  renderDisallowAllRobotsTxt,
  renderRobotsTxt,
  STOREFRONT_DISALLOWED_PATHS
} from "../apps/web/src/modules/seo/robots";
import {
  buildCategorySitemapDocument,
  buildMarketingSitemapDocument,
  buildProductSitemapDocument,
  buildSitemapIndexDocument,
  buildStorefrontPagesDocument,
  countProductSitemapPages,
  parseSitemapSection,
  productSitemapSkip,
  SITEMAP_INDEX_PATH,
  sitemapSectionPath,
  type SitemapSection
} from "../apps/web/src/modules/seo/sitemap-documents";
import {
  renderSitemapUrlSet,
  SITEMAP_URLS_PER_SECTION
} from "../apps/web/src/modules/seo/sitemap-xml";
import { toAbsoluteUrl } from "../apps/web/src/modules/seo/url";

const APP_DIR = join(process.cwd(), "apps", "web", "src", "app");
const SEO_DIR = join(process.cwd(), "apps", "web", "src", "modules", "seo");
const ORIGIN = "https://ds-shop.storeim.com";
const UPDATED_AT = new Date("2026-02-14T09:30:00.000Z");

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function locs(document: string) {
  return [...document.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? "");
}

function paths(document: string) {
  return locs(document).map((loc) => new URL(loc).pathname);
}

console.log("=== Documents ===");

const productDocument = buildProductSitemapDocument(ORIGIN, [
  {
    images: [{ url: "/uploads/stores/store_1/lead.jpg" }, { url: "data:image/png;base64,AAAA" }],
    slug: "argan-hair-oil",
    updatedAt: UPDATED_AT
  },
  {
    images: [],
    slug: "tea-&-coffee-set",
    updatedAt: UPDATED_AT
  }
]);

check(
  "a product URL carries loc, lastmod, changefreq and priority in schema order",
  /<url>\s*<loc>[^<]+<\/loc>\s*<lastmod>[^<]+<\/lastmod>\s*<changefreq>[^<]+<\/changefreq>\s*<priority>[^<]+<\/priority>/.test(
    productDocument
  )
);
check(
  "lastmod is a W3C datetime",
  productDocument.includes(`<lastmod>${UPDATED_AT.toISOString()}</lastmod>`)
);
check(
  "a relative image key becomes an absolute URL",
  productDocument.includes(`<image:loc>${ORIGIN}/uploads/stores/store_1/lead.jpg</image:loc>`)
);
check(
  "a data: URI is dropped rather than inlined",
  !productDocument.includes("data:image"),
  "one embedded image would outweigh the document carrying it"
);
check(
  "the image namespace is declared when a product has a photo",
  productDocument.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
);
check(
  "and left out when nothing uses it",
  !buildCategorySitemapDocument(ORIGIN, [{ slug: "haircare", updatedAt: UPDATED_AT }]).includes(
    "xmlns:image"
  ),
  "so a store with no photos still validates against the plain schema"
);
check(
  "a slug is percent-encoded per segment",
  productDocument.includes("/products/tea-%26-coffee-set"),
  "a raw ampersand in a loc is a parse error that takes the document with it"
);
check(
  "XML entities are escaped",
  renderSitemapUrlSet([{ loc: `${ORIGIN}/products?a=1&b=2` }]).includes("a=1&amp;b=2")
);
check(
  "an empty section still renders a well-formed, empty urlset",
  renderSitemapUrlSet([]).trim().endsWith("</urlset>")
);
check(
  "a relative path resolves against the origin and an unusable one is refused",
  toAbsoluteUrl(ORIGIN, "/uploads/a.jpg") === `${ORIGIN}/uploads/a.jpg` &&
    toAbsoluteUrl(ORIGIN, "   ") === null &&
    toAbsoluteUrl(ORIGIN, "javascript:alert(1)") === null
);

console.log("\n=== Sections ===");

const allSections: SitemapSection[] = [
  { kind: "pages" },
  { kind: "categories" },
  { kind: "products", page: 1 },
  { kind: "products", page: 12 }
];

check(
  "every section name the index emits parses back to the same section",
  allSections.every((section) => {
    const name = sitemapSectionPath(section).replace("/sitemap/", "");

    return JSON.stringify(parseSitemapSection(name)) === JSON.stringify(section);
  })
);
check(
  "junk section names are refused rather than served as an empty sitemap",
  ["products-0.xml", "products.xml", "products-1", "pages.XML", "../robots.txt", ""].every(
    (name) => parseSitemapSection(name) === null
  )
);
check(
  "the index names one document per section",
  paths(buildSitemapIndexDocument(ORIGIN, allSections)).join(",") ===
    "/sitemap/pages.xml,/sitemap/categories.xml,/sitemap/products-1.xml,/sitemap/products-12.xml"
);
check(
  "the index carries no guessed lastmod",
  !buildSitemapIndexDocument(ORIGIN, allSections).includes("<lastmod>"),
  "a crawler that trusts a stale timestamp skips the whole section"
);
check(
  "a catalogue is split into whole sections",
  countProductSitemapPages(0) === 0 &&
    countProductSitemapPages(1) === 1 &&
    countProductSitemapPages(SITEMAP_URLS_PER_SECTION) === 1 &&
    countProductSitemapPages(SITEMAP_URLS_PER_SECTION + 1) === 2
);
check(
  "each section reads from where the previous one stopped",
  productSitemapSkip(1) === 0 && productSitemapSkip(3) === SITEMAP_URLS_PER_SECTION * 2
);

console.log("\n=== Marketing ===");

const marketingPaths = paths(buildMarketingSitemapDocument("https://storeim.com"));

check(
  "the landing page and the docs index are submitted",
  marketingPaths.includes("/") && marketingPaths.includes("/docs")
);
check(
  "every docs page is submitted",
  docsPages.every((page) => marketingPaths.includes(`/docs/${page.slug}`)),
  `${docsPages.length} pages in the handbook`
);
check(
  "the seller app is not",
  !marketingPaths.some((path) =>
    ["/admin", "/dashboard", "/invite", "/login", "/register", "/s/"].some((prefix) =>
      path.startsWith(prefix)
    )
  )
);

console.log("\n=== Sitemap and robots agree ===");

const submittedPaths = [
  buildStorefrontPagesDocument(ORIGIN, UPDATED_AT),
  buildCategorySitemapDocument(ORIGIN, [{ slug: "haircare", updatedAt: UPDATED_AT }]),
  productDocument
].flatMap((document) => paths(document));

check(
  "no URL the storefront sitemap submits is disallowed to crawlers",
  submittedPaths.every(
    (path) => !STOREFRONT_DISALLOWED_PATHS.some((disallowed) => path.startsWith(disallowed))
  ),
  "submitting a URL robots.txt blocks is how a sitemap earns a Search Console error"
);
check(
  "no URL the marketing sitemap submits is disallowed either",
  marketingPaths.every(
    (path) => !MARKETING_DISALLOWED_PATHS.some((disallowed) => path.startsWith(disallowed))
  )
);

// Every directory under the storefront tree is a route a crawler can reach, so
// each one has to be a decision: submitted, disallowed, or a known redirect.
const KNOWN_REDIRECT_ROUTES = ["[category]"];
const undecidedRoutes = readdirSync(join(APP_DIR, "storefront", "[slug]"), {
  withFileTypes: true
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((route) => {
    const path = `/${route}`;

    return (
      !KNOWN_REDIRECT_ROUTES.includes(route) &&
      !submittedPaths.includes(path) &&
      !STOREFRONT_DISALLOWED_PATHS.some((disallowed) => path.startsWith(disallowed))
    );
  });

check(
  "every storefront route is submitted, disallowed, or a known redirect",
  undecidedRoutes.length === 0,
  undecidedRoutes.length > 0 ? `undecided: ${undecidedRoutes.join(", ")}` : ""
);
check(
  "the storefront robots.txt points at the sitemap index",
  renderRobotsTxt({
    disallow: STOREFRONT_DISALLOWED_PATHS,
    sitemapUrl: `${ORIGIN}${SITEMAP_INDEX_PATH}`
  }).includes(`Sitemap: ${ORIGIN}/sitemap.xml`)
);
check(
  "a disallow-all robots.txt advertises no sitemap",
  renderDisallowAllRobotsTxt().includes("Disallow: /") &&
    !renderDisallowAllRobotsTxt().includes("Sitemap:")
);

console.log("\n=== Tenancy and refusals ===");

const repository = readFileSync(join(SEO_DIR, "sitemap.repository.ts"), "utf8");
const indexRoute = readFileSync(join(APP_DIR, "sitemap.xml", "route.ts"), "utf8");
const sectionRoute = readFileSync(join(APP_DIR, "sitemap", "[section]", "route.ts"), "utf8");
const robotsRoute = readFileSync(join(APP_DIR, "robots.txt", "route.ts"), "utf8");

check(
  "every sitemap read is scoped to one store",
  repository
    .split("prisma.")
    .slice(1)
    .every((query) => query.includes("storeId"))
);
check(
  "products are narrowed by the storefront's own visibility clause",
  repository.includes('import { publicProductWhere } from "../storefront/resolver"') &&
    !/status:\s*"ACTIVE"/.test(repository),
  "a second copy of the clause is a second place for DRAFT to leak into a sitemap"
);
const findProductsSource = repository.slice(
  repository.indexOf("export async function findSitemapProducts"),
  repository.indexOf("export async function findSitemapCategories")
);
// The product-level orderBy alone. The images relation has one of its own
// earlier in the same call, and the next function's select mentions
// updatedAt — a looser match reads either of those as this one.
const orderByStart = findProductsSource.indexOf("orderBy: [");
const productOrderBy = findProductsSource.slice(
  orderByStart,
  findProductsSource.indexOf("]", orderByStart)
);

check(
  "product paging orders by creation, not by edit",
  productOrderBy.includes("createdAt") && !productOrderBy.includes("updatedAt"),
  "an order that moves an edited row drops products between two crawler fetches"
);
check(
  "the sitemap index refuses any host that serves no storefront",
  indexRoute.includes('surface.kind !== "storefront"') &&
    indexRoute.includes("status: 404")
);
check(
  "so does each section",
  sectionRoute.includes('surface.kind !== "storefront"')
);
check(
  "robots.txt disallows the seller app and any unknown host",
  /surface\.kind === "seller-app" \|\| surface\.kind === "unresolved"/.test(robotsRoute) &&
    robotsRoute.includes("renderDisallowAllRobotsTxt()")
);
check(
  "a servable store is an indexable one",
  !readFileSync(join(SEO_DIR, "seo-request.ts"), "utf8").includes("store.status"),
  "DRAFT is the status every store is created with and no seller can change, so gating on ACTIVE would 404 for almost every real shop"
);

console.log("\n=== Canonicals the sitemap depends on ===");

const metadataPages = [
  "categories/page.tsx",
  "categories/[categorySlug]/page.tsx",
  "products/page.tsx",
  "products/[productSlug]/page.tsx"
];

check(
  "every submitted page type declares its own canonical",
  metadataPages.every((page) => {
    const source = readFileSync(join(APP_DIR, "storefront", "[slug]", page), "utf8");

    return (
      source.includes("export async function generateMetadata") &&
      source.includes("storefrontCanonicalUrl")
    );
  }),
  "without one they inherit the layout's and every product claims to be the homepage"
);
check(
  "and the /s/ rewrite target re-exports it",
  metadataPages.every((page) =>
    readFileSync(join(APP_DIR, "s", "[slug]", page), "utf8").includes("generateMetadata")
  ),
  "/s/<slug> is what a storefront request actually renders"
);
check(
  "the layout no longer hardcodes its canonical",
  (() => {
    const layout = readFileSync(join(APP_DIR, "storefront", "[slug]", "layout.tsx"), "utf8");

    return layout.includes("storefrontCanonicalUrl(store)") && !layout.includes("storeSubdomain(");
  })(),
  "one helper, so a page's canonical and the sitemap's host cannot drift apart"
);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
