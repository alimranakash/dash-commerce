/**
 * Wishlist check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * wishlist — the same shape as `verify-shopping-agent.mts`, and deliberately the
 * half of it that needs neither a database nor a request.
 *
 * Four things are driven.
 *
 * The *contract* checks run the request schema for real. It is the boundary the
 * public route parses untrusted form data at, and the case worth stating twice
 * is `clear`: it is the only action with no product, so a `clear` must parse
 * without one while an `add` must not.
 *
 * The *tenancy* checks read the modules as text rather than calling them — the
 * service pulls in Prisma and `next/headers` through the storefront resolver,
 * which cannot load outside Next, the same reason `verify-staff-permissions.mts`
 * inspects action modules as text. It is also the stronger assertion here:
 * "every query is scoped by storeId" is true of the file or it is not, whereas
 * one scoped call proves nothing about the next.
 *
 * The *visibility* checks tie the wishlist to the storefront's own read layer. A
 * wishlist is looked at weeks after it is filled, so a saved row is re-read
 * rather than replayed from a snapshot, and it comes back through
 * `publicProductWhere` — a product that went DRAFT or HIDDEN can no more be
 * saved, listed or reported on than linked.
 *
 * The *crawler* checks assert the three places that have to agree about a page
 * nobody should index: the sitemap does not submit it, `robots.ts` disallows it,
 * and the page itself sends `noindex`.
 *
 * Covers:
 * - the request schema accepting the four actions and refusing a fifth;
 * - `clear` parsing without a product and `add` refusing to;
 * - a blank or oversized product id being refused;
 * - the route resolving the tenant from the storefront slug, never from a
 *   posted `storeId`;
 * - every repository statement naming `storeId`, so a stolen cookie alone reads
 *   nothing;
 * - the cookie being signed, and minted only where a cookie may be set;
 * - saves being re-read through the storefront resolver rather than snapshotted;
 * - the seller's demand report narrowing to ACTIVE and PUBLIC products;
 * - `/wishlist` being unsubmitted, disallowed and `noindex`;
 * - the `/s/` stub re-exporting the page's metadata as well as its default.
 *
 * Run with: npm run verify:wishlist
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STOREFRONT_DISALLOWED_PATHS } from "../apps/web/src/modules/seo/robots";
import { buildStorefrontPagesDocument } from "../apps/web/src/modules/seo/sitemap-documents";
import { wishlistRequestSchema } from "../apps/web/src/modules/wishlist/wishlist.schema";

const MODULE_DIR = join(process.cwd(), "apps", "web", "src", "modules", "wishlist");
const APP_DIR = join(process.cwd(), "apps", "web", "src", "app");
const ORIGIN = "https://demo-shop.storeim.com";

const source = {
  repository: read("wishlist.repository.ts"),
  service: read("wishlist.service.ts"),
  token: read("wishlist-token.ts")
};
const route = readFileSync(join(APP_DIR, "api", "wishlist", "route.ts"), "utf8");
const page = readFileSync(join(APP_DIR, "storefront", "[slug]", "wishlist", "page.tsx"), "utf8");
const stub = readFileSync(join(APP_DIR, "s", "[slug]", "wishlist", "page.tsx"), "utf8");

let failures = 0;

function read(file: string) {
  return readFileSync(join(MODULE_DIR, file), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks below that assert a name is *absent* have to read the code: the doc
 * comments name `storeId` and `price` while explaining the rules about them, and
 * scanning the raw file would fail on its own explanation — the worst kind of
 * check, because it punishes the comment that makes the guarantee legible.
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

console.log("=== Request contract ===");

for (const action of ["add", "remove", "toggle"] as const) {
  check(
    `${action} parses with a product`,
    wishlistRequestSchema.safeParse({ productId: "prod_1", wishlistAction: action }).success
  );
  check(
    `${action} is refused without one`,
    !wishlistRequestSchema.safeParse({ wishlistAction: action }).success
  );
}

check(
  "clear parses without a product",
  wishlistRequestSchema.safeParse({ wishlistAction: "clear" }).success
);
check(
  "an unknown action is refused",
  !wishlistRequestSchema.safeParse({ productId: "prod_1", wishlistAction: "empty" }).success
);
check(
  "a blank product id is refused",
  !wishlistRequestSchema.safeParse({ productId: "   ", wishlistAction: "add" }).success
);
check(
  "an oversized product id is refused",
  !wishlistRequestSchema.safeParse({ productId: "x".repeat(65), wishlistAction: "add" }).success
);

console.log("\n=== Tenancy ===");

check(
  "the route resolves the store from the storefront slug",
  route.includes("getStorefrontBySlug(storeSlug)")
);
check("the route never reads a posted storeId", !/formData, "storeId"/.test(code(route)));

const statements =
  code(source.repository).match(/(SELECT|INSERT INTO|DELETE FROM)[\s\S]*?`/g) ?? [];

check(
  "every repository statement is scoped by storeId",
  statements.length > 0 && statements.every((statement) => statement.includes('"storeId"')),
  `${statements.length} statements`
);
check(
  "the cookie carries a signature, not a bare token",
  source.token.includes("createHmac") && source.token.includes("timingSafeEqual")
);

const beforeMint = code(source.token).split("export async function requireWishlistToken")[0] ?? "";

check(
  "reads never mint a token, so a page render writes no cookie",
  code(source.token).includes("export async function readWishlistToken") &&
    !beforeMint.includes("cookieStore.set")
);
check(
  "only the write paths ask for a token that may be minted",
  code(source.service).includes("readWishlistToken") &&
    code(source.service).includes("requireWishlistToken")
);

console.log("\n=== Visibility ===");

check(
  "saved products are re-read through the storefront resolver",
  code(source.service).includes("getStorefrontProductsByIds")
);
check("the service never queries Prisma itself", !code(source.service).includes("prisma."));
check(
  "a product is checked against the same read layer before it can be saved",
  /requirePublicProduct[\s\S]*?getStorefrontProductsByIds/.test(code(source.service))
);
check(
  "the seller's demand report is narrowed to ACTIVE and PUBLIC",
  code(source.repository).includes(`p."status" = 'ACTIVE'`) &&
    code(source.repository).includes(`p."visibility" = 'PUBLIC'`)
);
check(
  "a saved row holds an id, not a price that could go stale",
  !/"(price|compareAtPrice|imageUrl)"/.test(code(source.repository))
);

console.log("\n=== Crawlers ===");

check(
  "the sitemap does not submit /wishlist",
  !buildStorefrontPagesDocument(ORIGIN, new Date()).includes(`${ORIGIN}/wishlist`)
);
check("robots.txt disallows /wishlist", STOREFRONT_DISALLOWED_PATHS.includes("/wishlist"));
check("the page itself sends noindex", /index:\s*false/.test(page));
check(
  "the /s/ stub re-exports the metadata as well as the page",
  stub.includes("default") && stub.includes("metadata")
);

console.log(
  failures === 0
    ? "\nWishlist: all checks passed."
    : `\nWishlist: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);
