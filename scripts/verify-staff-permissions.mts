/**
 * Staff permission check.
 *
 * Two things, neither of which needs a database or a session:
 *
 * 1. `isStoreManager` over every role combination — the single definition of
 *    "manager" that the pages, the actions, and the sidebar all read.
 * 2. Which guard each server-action module uses, asserted against the
 *    classification below. This is the point of the script: the decision about
 *    who may do what is otherwise spread across twenty-odd files where a new
 *    action can quietly pick the wrong guard. Here it is one table that fails
 *    loudly — including when a new `*.actions.ts` appears that nobody has
 *    classified.
 *
 * Run with: npm run verify:staff-permissions
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { isStoreManager } from "../apps/web/src/modules/stores/queries";

type GuardExpectation = "manager" | "member" | "mixed";

const MODULES_DIR = join(process.cwd(), "apps", "web", "src", "modules");

/**
 * `manager` — every action needs owner/admin.
 * `member`  — ordinary work, any team member may do it.
 * `mixed`   — the file holds both, and the comment in it says which is which.
 */
const EXPECTED_GUARDS: Record<string, GuardExpectation> = {
  "abandoned-carts/abandoned-cart.actions.ts": "member",
  "billing/billing-features.actions.ts": "member",
  "billing/billing.actions.ts": "manager",
  "categories/category.actions.ts": "member",
  "courier/courier.actions.ts": "mixed",
  "demo-packs/manager.actions.ts": "manager",
  "domains/domains.actions.ts": "manager",
  "expenses/expense.actions.ts": "member",
  "fake-orders/fake-order.actions.ts": "member",
  "inventory/inventory.actions.ts": "member",
  "marketing/marketing.actions.ts": "manager",
  "media/media.actions.ts": "member",
  "orders/order.actions.ts": "member",
  "payments/payment.actions.ts": "manager",
  "product-content/product-content.actions.ts": "member",
  "ai-provider/ai-provider.actions.ts": "manager",
  "products/product-taxonomy.actions.ts": "member",
  "products/product.actions.ts": "member",
  "purchases/purchase.actions.ts": "member",
  "sales/sale.actions.ts": "member",
  "settings/settings.actions.ts": "manager",
  "shipping/shipping.actions.ts": "manager",
  "staff/staff.actions.ts": "manager",
  "storefront/templates/template.actions.ts": "manager",
  "storeos/storeos.actions.ts": "mixed",
  "suppliers/supplier.actions.ts": "member"
};

/** Action modules that legitimately use no store guard at all. */
const NO_STORE_GUARD = new Set([
  "admin/admin-payments.actions.ts",
  "admin/admin-plans.actions.ts",
  "admin/admin-stores.actions.ts",
  "admin/admin-subscriptions.actions.ts",
  "admin/admin-support.actions.ts",
  "admin/admin-users.actions.ts",
  "profile/profile.actions.ts",
  "stores/store-access.actions.ts"
]);

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

async function listActionModules(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listActionModules(full)));
    } else if (entry.name.endsWith(".actions.ts")) {
      files.push(full);
    }
  }

  return files;
}

async function main() {
  console.log("=== isStoreManager ===");
  check("owner manages", isStoreManager({ organizationRole: "OWNER", platformRole: "MEMBER" }));
  check("admin manages", isStoreManager({ organizationRole: "ADMIN", platformRole: "MEMBER" }));
  check("member does not", !isStoreManager({ organizationRole: "MEMBER", platformRole: "MEMBER" }));
  check(
    "missing org role does not",
    !isStoreManager({ organizationRole: undefined, platformRole: undefined })
  );
  check(
    "platform admin manages regardless of org role",
    isStoreManager({ organizationRole: "MEMBER", platformRole: "ADMIN" })
  );

  console.log("\n=== Guard used by each action module ===");
  const files = await listActionModules(MODULES_DIR);
  const seen = new Set<string>();

  for (const file of files.sort()) {
    const key = relative(MODULES_DIR, file).split(sep).join("/");

    seen.add(key);

    const source = readFileSync(file, "utf8");
    // `requireStore(` cannot match `requireStoreManager(` — the character after
    // the shared prefix differs — so the two counts stay independent.
    const usesStore = /\brequireStore\(/.test(source);
    const usesManager = /\brequireStoreManager\(/.test(source);
    const expected = EXPECTED_GUARDS[key];

    if (!expected) {
      check(
        `${key} is classified`,
        NO_STORE_GUARD.has(key),
        NO_STORE_GUARD.has(key)
          ? "no store guard, as expected"
          : "new action module — add it to EXPECTED_GUARDS or NO_STORE_GUARD"
      );
      continue;
    }

    if (expected === "manager") {
      check(
        `${key} is manager-only`,
        usesManager && !usesStore,
        usesStore ? "still calls requireStore()" : "requireStoreManager() only"
      );
    } else if (expected === "member") {
      check(
        `${key} stays open to members`,
        usesStore && !usesManager,
        usesManager ? "unexpectedly calls requireStoreManager()" : "requireStore() only"
      );
    } else {
      check(
        `${key} uses both guards`,
        usesStore && usesManager,
        "mixed, as documented in the file"
      );
    }
  }

  const missing = Object.keys(EXPECTED_GUARDS).filter((key) => !seen.has(key));

  check("every classified module still exists", missing.length === 0, missing.join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(() => {
    console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
