/**
 * StoreIM AI connection foundation check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * StoreIM AI connection layer — the same shape as `verify-ai-api.mts`. It
 * creates throwaway organizations, stores and domains, drives the real service,
 * identity and state modules against a real database, and deletes the fixtures
 * on the way out.
 *
 * Three layers are driven, on purpose.
 *
 * The *state* checks call `toStoreOSConnectionView` directly, because the five
 * phases a seller can see are easier to assert exhaustively as a function than
 * as a rendered page.
 *
 * The *service* checks run the real connect path with the platform link both
 * unprovisioned and pointed at a sentinel URL that cannot answer, so both the
 * "not switched on" and the "failed" branches are exercised for real.
 *
 * The *source* checks read the action module rather than calling it — it imports
 * the NextAuth options, which cannot load outside Next, which is the same reason
 * `verify-staff-permissions.mts` inspects `*.actions.ts` as text. For this
 * property it is also the stronger assertion: "the action never reads a store
 * selector out of the request" is true of the code or it is not, whereas one
 * call that happens to pass no `storeId` proves nothing about the next.
 *
 * Covers:
 * - the reconnect action guarding with `requireStoreManager()` before it
 *   connects anything, so an unauthenticated caller never reaches StoreOS;
 * - the action reading no field out of the submitted form and taking no store,
 *   tenant, or site parameter, so browser-supplied selectors cannot switch store;
 * - the connection envelope being re-derived from the store row: id, name, slug,
 *   subdomain, storefront URL, verified custom domain — and an *unverified*
 *   custom domain being ignored;
 * - connecting one store leaving every other store row untouched;
 * - the platform credential appearing in no view, no action result, and no error
 *   message, and being referenced by no component or page;
 * - all five connection phases, including connected with no connection id;
 * - a row written by the previous implementation still reading as connected;
 * - the chat fallback answering when no connection exists, and naming no
 *   environment variable.
 *
 * Run with: npm run verify:storeim-ai
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@dash/db";
import {
  STOREOS_CAPABILITY_CATALOG,
  requestedCapabilities
} from "../apps/web/src/modules/storeos/storeos-capabilities";
import {
  readGrantedCapabilities,
  storeOSPhaseLabel,
  toStoreOSConnectionView,
  type StoreOSConnectionPhase,
  type StoreOSConnectionRow
} from "../apps/web/src/modules/storeos/storeos-connection-state";
import { buildStoreOSConnectionIdentity } from "../apps/web/src/modules/storeos/storeos-identity";
import {
  connectStoreOSForStore,
  getStoreOSConnection,
  getStoreOSConnectionView,
  sendStoreOSAssistantMessage
} from "../apps/web/src/modules/storeos/storeos.service";

const webSrc = join(process.cwd(), "apps", "web", "src");

/**
 * Sentinels for the platform link.
 *
 * The SDK reads the environment on every call, so these can be installed and
 * removed around individual checks. The host is deliberately unroutable: the
 * connect path has to make a real attempt and fail, so the error branch under
 * test is the real error branch. Port 1 refuses immediately rather than hanging.
 */
const SENTINEL_URL = "http://127.0.0.1:1/storeos-sentinel-url";
const SENTINEL_KEY = "storeos-sentinel-key-1a2b3c4d5e6f";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

function withLink<T>(run: () => Promise<T>) {
  process.env.STOREOS_API_URL = SENTINEL_URL;
  process.env.STOREOS_API_KEY = SENTINEL_KEY;

  return run().finally(() => {
    delete process.env.STOREOS_API_URL;
    delete process.env.STOREOS_API_KEY;
  });
}

/** Would this value tell a browser anything about the operator's credential? */
function leaksSentinel(value: unknown) {
  const serialized = typeof value === "string" ? value : (JSON.stringify(value) ?? "");

  return (
    serialized.includes(SENTINEL_KEY) ||
    serialized.includes(SENTINEL_URL) ||
    serialized.includes("STOREOS_API_KEY") ||
    serialized.includes("STOREOS_API_URL")
  );
}

const suffix = Date.now().toString(36);

type Fixture = {
  organizationId: string;
  slug: string;
  storeId: string;
  storeName: string;
};

async function createFixture(label: string): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: {
      name: `StoreIM AI ${label} ${suffix}`,
      slug: `storeim-ai-org-${suffix}-${randomUUID().slice(0, 8)}`
    }
  });
  const slug = `storeim-ai-${label}-${suffix}-${randomUUID().slice(0, 6)}`;
  const store = await prisma.store.create({
    data: {
      country: "BD",
      currency: "BDT",
      name: `StoreIM AI ${label} ${suffix}`,
      organizationId: organization.id,
      slug,
      status: "ACTIVE",
      timezone: "Asia/Dhaka"
    }
  });

  return {
    organizationId: organization.id,
    slug,
    storeId: store.id,
    storeName: store.name
  };
}

async function destroyFixture(fixture: Fixture) {
  await prisma.organization.delete({
    where: {
      id: fixture.organizationId
    }
  });
}

async function main() {
  const alpha = await createFixture("alpha");
  const beta = await createFixture("beta");

  try {
    console.log("=== Connection identity is derived from the store row ===");

    const identity = await buildStoreOSConnectionIdentity(alpha.storeId);

    check("identity carries the authenticated store id", identity.store.id === alpha.storeId);
    check("identity carries the store name", identity.store.name === alpha.storeName);
    check("identity carries the slug", identity.store.slug === alpha.slug);
    check(
      "identity carries the platform subdomain",
      identity.store.subdomain.startsWith(`${alpha.slug}.`),
      identity.store.subdomain
    );
    check(
      "storefront URL falls back to the subdomain",
      identity.store.storefrontUrl === `https://${identity.store.subdomain}`,
      identity.store.storefrontUrl
    );
    check("no custom domain is claimed yet", identity.store.customDomain === undefined);
    check(
      "identity carries the owning organization",
      identity.organization.id === alpha.organizationId
    );
    check(
      "identity carries currency, country and timezone",
      identity.store.currency === "BDT" &&
        identity.store.country === "BD" &&
        identity.store.timezone === "Asia/Dhaka"
    );

    const unverifiedHost = `unverified-${suffix}.example.com`;
    await prisma.storeDomain.create({
      data: {
        domain: unverifiedHost,
        isPrimary: true,
        storeId: alpha.storeId,
        type: "CUSTOM"
      }
    });

    const withUnverified = await buildStoreOSConnectionIdentity(alpha.storeId);

    check(
      "an unverified custom domain is not presented as identity",
      withUnverified.store.customDomain === undefined &&
        !withUnverified.store.storefrontUrl.includes(unverifiedHost)
    );

    const verifiedHost = `verified-${suffix}.example.com`;
    await prisma.storeDomain.create({
      data: {
        domain: verifiedHost,
        isPrimary: false,
        storeId: alpha.storeId,
        type: "CUSTOM",
        verifiedAt: new Date()
      }
    });

    const withVerified = await buildStoreOSConnectionIdentity(alpha.storeId);

    check(
      "a verified custom domain becomes the storefront URL",
      withVerified.store.customDomain === verifiedHost &&
        withVerified.store.storefrontUrl === `https://${verifiedHost}`,
      withVerified.store.storefrontUrl
    );
    check(
      "the platform subdomain is still reported alongside it",
      withVerified.store.subdomain.startsWith(`${alpha.slug}.`)
    );

    let identityRefused = false;

    try {
      await buildStoreOSConnectionIdentity(`missing-${randomUUID()}`);
    } catch {
      identityRefused = true;
    }

    check("an unknown store id cannot produce an identity", identityRefused);

    console.log("\n=== The platform link is the operator's, not the merchant's ===");

    const unprovisioned = await connectStoreOSForStore(alpha.storeId);

    check(
      "connecting without a platform link leaves the row pending",
      unprovisioned.status === "pending" && unprovisioned.storeosConnectionId === null,
      unprovisioned.status
    );

    const pendingView = await getStoreOSConnectionView(alpha.storeId);

    check(
      "an unprovisioned platform reads as Not connected",
      pendingView.phase === "not-connected" && pendingView.label === "Not connected"
    );
    check(
      "the seller is not told to configure anything",
      !/STOREOS_API|api key|environment|\.env/i.test(pendingView.detail),
      pendingView.detail
    );
    check("no credential reaches the connection view", !leaksSentinel(pendingView));

    const failedConnect = await withLink(async () => {
      let thrown: unknown = null;

      try {
        await connectStoreOSForStore(alpha.storeId);
      } catch (error) {
        thrown = error;
      }

      return {
        message: thrown instanceof Error ? thrown.message : String(thrown),
        thrown,
        view: await getStoreOSConnectionView(alpha.storeId)
      };
    });

    check("an unreachable StoreOS raises an error", failedConnect.thrown !== null);
    check(
      "the error names no credential, host, or variable",
      !leaksSentinel(failedConnect.message) && !failedConnect.message.includes("127.0.0.1"),
      failedConnect.message
    );
    check(
      "the error is a sentence a seller can act on",
      /try connecting again/i.test(failedConnect.message) &&
        !/fetch failed|ECONNREFUSED|undici/i.test(failedConnect.message),
      failedConnect.message
    );
    check(
      "a failed attempt reads as Connection failed",
      failedConnect.view.phase === "failed" && failedConnect.view.label === "Connection failed",
      failedConnect.view.phase
    );
    check("no credential reaches the failed view", !leaksSentinel(failedConnect.view));

    console.log("\n=== Connecting one store touches only that store ===");

    check(
      "the other store has no connection row",
      (await getStoreOSConnection(beta.storeId)) === null
    );

    await connectStoreOSForStore(beta.storeId);

    const alphaAfter = await getStoreOSConnection(alpha.storeId);
    const betaAfter = await getStoreOSConnection(beta.storeId);

    check(
      "each row is bound to its own store",
      alphaAfter?.storeId === alpha.storeId && betaAfter?.storeId === beta.storeId
    );
    check(
      "connecting the second store did not rewrite the first",
      alphaAfter?.status === "error",
      alphaAfter?.status ?? "missing"
    );

    console.log("\n=== Connection phases ===");

    const phaseCases: Array<{
      expected: StoreOSConnectionPhase;
      label: string;
      linkProvisioned: boolean;
      row: StoreOSConnectionRow | null;
    }> = [
      {
        expected: "not-connected",
        label: "no row at all",
        linkProvisioned: true,
        row: null
      },
      {
        expected: "not-connected",
        label: "pending",
        linkProvisioned: true,
        row: { capabilities: {}, lastSyncedAt: null, status: "pending", storeosConnectionId: null }
      },
      {
        expected: "connected",
        label: "connected with an id",
        linkProvisioned: true,
        row: {
          capabilities: { granted: ["ai:chat"] },
          lastSyncedAt: new Date(),
          status: "connected",
          storeosConnectionId: "conn_1"
        }
      },
      {
        expected: "reconnect-required",
        label: "connected with no id",
        linkProvisioned: true,
        row: {
          capabilities: {},
          lastSyncedAt: new Date(),
          status: "connected",
          storeosConnectionId: null
        }
      },
      {
        expected: "reconnect-required",
        label: "disabled",
        linkProvisioned: true,
        row: {
          capabilities: {},
          lastSyncedAt: new Date(),
          status: "disabled",
          storeosConnectionId: "conn_2"
        }
      },
      {
        expected: "failed",
        label: "error",
        linkProvisioned: true,
        row: { capabilities: {}, lastSyncedAt: null, status: "error", storeosConnectionId: null }
      },
      {
        expected: "not-connected",
        label: "unknown status",
        linkProvisioned: true,
        row: { capabilities: {}, lastSyncedAt: null, status: "wat", storeosConnectionId: "conn_3" }
      },
      {
        expected: "not-connected",
        label: "stale connected row, link withdrawn",
        linkProvisioned: false,
        row: {
          capabilities: { granted: ["ai:chat"] },
          lastSyncedAt: new Date(),
          status: "connected",
          storeosConnectionId: "conn_4"
        }
      }
    ];

    for (const testCase of phaseCases) {
      const view = toStoreOSConnectionView(testCase.row, testCase.linkProvisioned);

      check(
        `${testCase.label.padEnd(34)} -> ${testCase.expected}`,
        view.phase === testCase.expected,
        view.phase
      );
      check(
        `${testCase.label.padEnd(34)} -> safe copy`,
        view.detail.length > 0 && !leaksSentinel(view) && !/STOREOS_API/i.test(view.detail)
      );
    }

    check(
      "every phase has a label a seller can read",
      (["connected", "connecting", "failed", "not-connected", "reconnect-required"] as const).every(
        (phase) => storeOSPhaseLabel(phase).length > 0
      )
    );

    console.log("\n=== Existing connection rows stay compatible ===");

    // Exactly what the previous implementation wrote: capabilities `{}`, no
    // granted list, a connection id from StoreOS.
    const legacyView = toStoreOSConnectionView(
      {
        capabilities: {},
        lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
        status: "connected",
        storeosConnectionId: "legacy_conn"
      },
      true
    );

    check(
      "a pre-existing connected row still reads as connected",
      legacyView.phase === "connected"
    );
    check("its connection id survives", legacyView.connectionId === "legacy_conn");
    check("it simply has no granted capabilities", legacyView.capabilities.length === 0);
    check(
      "granted capabilities are read back from JSON",
      readGrantedCapabilities({ granted: ["ai:chat", "ai:product"] }).join(",") ===
        "ai:chat,ai:product"
    );
    check(
      "unknown capability strings are dropped, not trusted",
      readGrantedCapabilities({ granted: ["ai:chat", "ai:root", "admin"] }).join(",") === "ai:chat"
    );
    check(
      "malformed capability JSON degrades to nothing",
      readGrantedCapabilities(null).length === 0 &&
        readGrantedCapabilities("granted").length === 0 &&
        readGrantedCapabilities([1, 2]).length === 0
    );

    console.log("\n=== Chat fallback ===");

    const fallback = await sendStoreOSAssistantMessage(beta.storeId, {
      message: "আজ কত অর্ডার এসেছে?"
    });

    check("an unconnected store still gets an answer", fallback.message.length > 0);
    check("and is told it is not connected", fallback.connected === false);
    check(
      "the fallback names no environment variable",
      !/STOREOS_API|\.env/i.test(fallback.message),
      fallback.message
    );
    check("the fallback still suggests prompts", (fallback.suggestions?.length ?? 0) > 0);
    check("no credential reaches the chat result", !leaksSentinel(fallback));

    const linkedFallback = await withLink(() =>
      sendStoreOSAssistantMessage(beta.storeId, { message: "hello" })
    );

    check(
      "a provisioned platform with no connected store still falls back",
      linkedFallback.connected === false && !leaksSentinel(linkedFallback)
    );

    console.log("\n=== Capability boundary ===");

    check(
      "only chat is implemented today",
      STOREOS_CAPABILITY_CATALOG.filter((capability) => capability.available)
        .map((capability) => capability.key)
        .join(",") === "ai:chat"
    );
    check(
      "the full capability surface is declared",
      STOREOS_CAPABILITY_CATALOG.length === 7 &&
        [
          "ai:analytics",
          "ai:automation",
          "ai:customer",
          "ai:marketing",
          "ai:order",
          "ai:product"
        ].every((key) => STOREOS_CAPABILITY_CATALOG.some((entry) => entry.key === key))
    );
    check(
      "a connection negotiates all of them up front",
      requestedCapabilities().length === STOREOS_CAPABILITY_CATALOG.length
    );

    console.log("\n=== The reconnect action cannot be steered from the browser ===");

    /**
     * Read rather than called.
     *
     * The action module imports the NextAuth options, which cannot be loaded
     * outside Next — the same reason `verify-staff-permissions.mts` inspects
     * `*.actions.ts` as source. It is also the stronger assertion for this
     * particular property: "the action never reads a store selector out of the
     * request" is true of the code or it is not, whereas a single call that
     * happens to pass no `storeId` proves nothing about the next one.
     */
    const actionSource = await readFile(
      join(webSrc, "modules", "storeos", "storeos.actions.ts"),
      "utf8"
    );

    check(
      "the reconnect action guards with requireStoreManager()",
      actionSource.includes("await requireStoreManager()")
    );
    check(
      "the chat action guards with requireStore()",
      actionSource.includes("await requireStore()")
    );
    check(
      "the guard runs before the connection is attempted",
      actionSource.indexOf("await requireStoreManager()") <
        actionSource.indexOf("connectStoreOSForStore(")
    );
    check(
      "the connection is opened for the guarded store and nothing else",
      /connectStoreOSForStore\(store\.id\)/.test(actionSource) &&
        !/connectStoreOSForStore\((?!store\.id\))/.test(actionSource)
    );
    check(
      "the reconnect action never reads a field out of the request",
      !/formData\s*\.\s*(get|getAll|entries|forEach|has|keys|values)\b/.test(actionSource)
    );
    check(
      "no action takes a store, tenant, or site selector as a parameter",
      !/\b(storeId|tenantId|siteId|organizationId)\s*:\s*string/.test(
        actionSource.slice(actionSource.indexOf("export async function"))
      )
    );
    check("the actions do not name the platform credential", !/STOREOS_API/.test(actionSource));

    console.log("\n=== Source: the credential has one home ===");

    const browserSources = [
      join(webSrc, "modules", "storeos", "components", "storeos-connection-panel.tsx"),
      join(webSrc, "modules", "storeos", "components", "ai-chat.tsx"),
      join(webSrc, "modules", "ai", "components", "ai-integration-settings.tsx"),
      join(webSrc, "app", "dashboard", "ai", "page.tsx"),
      join(webSrc, "app", "dashboard", "settings", "integrations", "page.tsx")
    ];

    for (const path of browserSources) {
      const source = await readFile(path, "utf8");
      const name = path.split(/[\\/]/).slice(-2).join("/");

      check(
        `${name.padEnd(38)} names no credential`,
        !/STOREOS_API|process\.env\.STOREOS/.test(source)
      );
      check(
        `${name.padEnd(38)} makes no direct StoreOS call`,
        !/fetch\(\s*["'`]https?:/.test(source)
      );
    }

    const sdkClient = await readFile(
      join(process.cwd(), "packages", "storeos-sdk", "src", "client.ts"),
      "utf8"
    );

    check(
      "the SDK client is the only reader of the credential",
      sdkClient.includes("STOREOS_API_KEY") && sdkClient.includes("STOREOS_API_URL")
    );

    const serviceSource = await readFile(
      join(webSrc, "modules", "storeos", "storeos.service.ts"),
      "utf8"
    );

    check(
      "the service reaches the credential only through the SDK",
      !/process\.env\.STOREOS/.test(serviceSource)
    );
    check(
      "the service derives identity server-side",
      serviceSource.includes("buildStoreOSConnectionIdentity")
    );
  } finally {
    await destroyFixture(alpha);
    await destroyFixture(beta);
    await prisma.$disconnect();
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();
