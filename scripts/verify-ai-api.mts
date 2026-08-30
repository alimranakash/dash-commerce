/**
 * AI API foundation check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * external AI API — the same shape as `verify-courier-webhook.mts`. It creates
 * throwaway organizations, stores, products and orders, issues real keys through
 * the service, and asserts against a real database before deleting the fixtures
 * on the way out.
 *
 * Two layers are driven, on purpose. The credential checks call
 * `resolveApiKeyStore` directly, because a decision is easier to assert than a
 * response. The endpoint checks call the exported route handlers with real
 * `NextRequest` objects, so what is asserted is the status, headers and JSON an
 * external caller actually receives, with the auth wrapper, the scope check and
 * the throttle all in the path.
 *
 * Credentials:
 * - a valid key authenticating and resolving to exactly its own store;
 * - a well-formed key that was never issued being refused;
 * - revoked and expired keys refused, and a suspended store closing the door;
 * - a missing header and seven shapes of malformed header all failing closed;
 * - scope enforcement, including that write scopes cannot yet be granted at all;
 * - the raw key never reaching the database, the key summaries, or any log.
 * - a stored key decrypting back to exactly what was issued, only for its own
 *   store, and a key with nothing stored to decrypt saying so rather than
 *   failing;
 * - deleting removing the row outright, scoped to the store, and the deleted
 *   key no longer authenticating.
 *
 * Endpoints:
 * - products, orders, metrics and all eight reports answering 200;
 * - each response carrying exactly its allow-listed fields and nothing else;
 * - `costPrice`, `ipAddress`, the fraud assessment and the street-level address
 *   absent; phone and email masked; every RED field from the audit scanned for
 *   as a raw substring of every successful body;
 * - cursor pagination: limits honoured, pages not overlapping, an over-large
 *   limit refused;
 * - cross-store isolation: `?storeId=` and `X-Store-Id` changing nothing, and
 *   another store's key seeing only its own rows;
 * - an unknown report key answering 404, an unsupported range 400;
 * - the per-address bucket turning the 121st request into a 429.
 *
 * Run with: npm run verify:ai-api
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@dash/db";
import { resetAiAuditCoalescing, resolveApiKeyStore } from "../apps/web/src/modules/ai/ai-auth";
import { getAiStoreContext } from "../apps/web/src/modules/ai/ai-context.service";
import {
  AI_API_KEY_PREFIX,
  createAiApiKey,
  hashAiApiKey
} from "../apps/web/src/modules/ai/ai-key-token";
import {
  deleteStoreApiKey,
  issueStoreApiKey,
  listStoreApiKeys,
  revealStoreApiKey,
  revokeStoreApiKey
} from "../apps/web/src/modules/ai/ai-key.service";
import { consumeAiApiToken, resetAiApiRateLimits } from "../apps/web/src/modules/ai/ai-rate-limit";
import { NextRequest } from "next/server";
import { GET as getContextRoute } from "../apps/web/src/app/api/ai/v1/context/route";
import { GET as getMetricsRoute } from "../apps/web/src/app/api/ai/v1/metrics/route";
import { GET as getOrdersRoute } from "../apps/web/src/app/api/ai/v1/orders/route";
import { GET as getProductsRoute } from "../apps/web/src/app/api/ai/v1/products/route";
import { GET as getReportRoute } from "../apps/web/src/app/api/ai/v1/reports/[reportKey]/route";
import { AI_REPORT_KEYS, aiStoreContextSchema } from "../apps/web/src/modules/ai/ai.schema";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

const suffix = Date.now().toString(36);

type Fixture = {
  organizationId: string;
  storeId: string;
};

async function createFixture(label: string, status: "ACTIVE" | "SUSPENDED"): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: {
      name: `AI API ${label} ${suffix}`,
      slug: `ai-org-${suffix}-${randomUUID().slice(0, 8)}`
    }
  });
  const store = await prisma.store.create({
    data: {
      businessType: "Beauty Store",
      country: "BD",
      currency: "BDT",
      name: `AI API ${label} ${suffix}`,
      organizationId: organization.id,
      slug: `ai-store-${suffix}-${randomUUID().slice(0, 8)}`,
      status,
      timezone: "Asia/Dhaka"
    }
  });

  return { organizationId: organization.id, storeId: store.id };
}

async function destroyFixture(fixture: Fixture) {
  // SystemLog nulls its store on delete rather than cascading, so the audit rows
  // this check produced are removed explicitly instead of being orphaned.
  await prisma.systemLog.deleteMany({ where: { storeId: fixture.storeId } });
  await prisma.store.deleteMany({ where: { id: fixture.storeId } });
  await prisma.organization.deleteMany({ where: { id: fixture.organizationId } });
}

/** A request shaped exactly as the route wrapper would hand it to auth. */
function apiRequest(
  authorization: string | null,
  url = "https://app.storeim.com/api/ai/v1/context"
) {
  const headers = new Headers();

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  return new Request(url, { headers });
}

/**
 * The same, as a `NextRequest`, for driving a real route handler.
 *
 * These checks go through the exported `GET` rather than calling the service
 * underneath it, so what is asserted is the response an external caller
 * actually receives — status, headers and JSON body — with the auth wrapper,
 * the scope check and the throttle all in the path.
 */
function routeRequest(key: string, path: string, clientIp?: string) {
  const headers = new Headers();

  headers.set("authorization", `Bearer ${key}`);

  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
  }

  return new NextRequest(`https://app.storeim.com${path}`, { headers });
}

type RouteResult = {
  body: unknown;
  raw: string;
  status: number;
};

async function readRoute(response: Response): Promise<RouteResult> {
  const raw = await response.text();

  return {
    body: raw ? (JSON.parse(raw) as unknown) : null,
    raw,
    status: response.status
  };
}

/**
 * The fields that must never appear in a successful API response, from the
 * previous audit's RED list.
 *
 * Scanned as raw substrings of the serialised body rather than by walking keys,
 * so a value that happens to carry one — a product titled "riskScore", a nested
 * object nobody thought to check — trips it too. Only 2xx bodies are scanned:
 * the word "credentials" legitimately appears in the 401 message.
 */
const FORBIDDEN_IN_RESPONSES = [
  "passwordHash",
  "access_token",
  "refresh_token",
  "id_token",
  // Catches `tokenHash`, `sessionToken`, `claimToken` and anything else of the
  // shape. Nothing legitimate on this API contains the word.
  "token",
  "Token",
  "credentials",
  "Cipher",
  "cipher",
  "Secret",
  "secret",
  "costPrice",
  "ipAddress",
  "riskScore",
  "riskLevel",
  "riskFactors",
  "verificationStatus",
  "markedFakeAt"
];

function forbiddenFieldsIn(raw: string) {
  return FORBIDDEN_IN_RESPONSES.filter((needle) => raw.includes(needle));
}

const capturedLogs: string[] = [];
const realConsole = {
  error: console.error,
  info: console.info,
  warn: console.warn
};

/** Collects everything the code under test logs, and keeps it off the report. */
function captureConsole() {
  capturedLogs.length = 0;

  const collect =
    (level: string) =>
    (...args: unknown[]) => {
      capturedLogs.push(`${level} ${args.map((arg) => String(arg)).join(" ")}`);
    };

  console.error = collect("error");
  console.info = collect("info");
  console.warn = collect("warn");
}

function releaseConsole() {
  console.error = realConsole.error;
  console.info = realConsole.info;
  console.warn = realConsole.warn;
}

async function main() {
  const primary = await createFixture("primary", "ACTIVE");
  const other = await createFixture("other", "ACTIVE");
  const suspended = await createFixture("suspended", "SUSPENDED");

  try {
    // ---------------------------------------------------------------- issuance

    const issued = await issueStoreApiKey(primary.storeId, {
      name: "StoreOS AI",
      scopes: ["read:store", "read:analytics"]
    });

    check(
      "an issued key carries the sk_live_ prefix",
      issued.key.startsWith(AI_API_KEY_PREFIX),
      issued.key.slice(0, AI_API_KEY_PREFIX.length)
    );
    check(
      "the hint is the last four characters of the raw key",
      issued.record.hint === issued.key.slice(-4)
    );
    check(
      "scopes are stored sorted and de-duplicated",
      JSON.stringify(issued.record.scopes) === JSON.stringify(["read:analytics", "read:store"]),
      JSON.stringify(issued.record.scopes)
    );

    let writeScopeRefused = false;

    try {
      await issueStoreApiKey(primary.storeId, {
        name: "Should not exist",
        scopes: ["write:products"]
      });
    } catch {
      writeScopeRefused = true;
    }

    check("a write scope cannot be granted while nothing enforces it", writeScopeRefused);

    // -------------------------------------------------- the raw key is not kept

    const storedRow = await prisma.storeApiKey.findUnique({ where: { id: issued.record.id } });
    const storedJson = JSON.stringify(storedRow);

    check(
      "the raw key is not anywhere in its own database row",
      storedRow !== null && !storedJson.includes(issued.key)
    );
    check(
      "what is stored is the SHA-256 of the key",
      storedRow?.tokenHash === hashAiApiKey(issued.key)
    );

    const wholeTable = JSON.stringify(await prisma.storeApiKey.findMany());

    check("the raw key appears nowhere in the key table", !wholeTable.includes(issued.key));

    const summaries = await listStoreApiKeys(primary.storeId);

    check(
      "listing keys never exposes the hash or the key",
      !JSON.stringify(summaries).includes(issued.key) &&
        !JSON.stringify(summaries).includes(hashAiApiKey(issued.key))
    );

    // --------------------------------------------- reading a stored key back

    check(
      "a listing says a key can be shown without carrying what would be shown",
      summaries.every((summary) => summary.canReveal) &&
        !JSON.stringify(summaries).includes(storedRow?.secretCipher ?? " ")
    );

    const revealed = await revealStoreApiKey(primary.storeId, issued.record.id);

    check(
      "a stored key decrypts back to exactly the key that was issued",
      revealed?.key === issued.key
    );
    check(
      "the reveal names the key it opened",
      revealed?.id === issued.record.id && revealed?.name === issued.record.name
    );
    check(
      "one store cannot read another store key by its id",
      (await revealStoreApiKey(other.storeId, issued.record.id)) === null
    );
    check(
      "an id that belongs to nothing reveals nothing",
      (await revealStoreApiKey(primary.storeId, `missing-${randomUUID()}`)) === null
    );

    const unreadable = await issueStoreApiKey(primary.storeId, {
      name: "Issued before keys were kept",
      scopes: ["read:store"]
    });

    // The shape of every key minted before this column existed.
    await prisma.storeApiKey.update({
      where: { id: unreadable.record.id },
      data: { secretCipher: null }
    });

    check(
      "a key with nothing stored to decrypt reveals nothing",
      (await revealStoreApiKey(primary.storeId, unreadable.record.id)) === null
    );
    check(
      "and the listing marks it as one that cannot be shown",
      (await listStoreApiKeys(primary.storeId)).find(
        (summary) => summary.id === unreadable.record.id
      )?.canReveal === false
    );

    resetAiAuditCoalescing();
    captureConsole();
    const stillWorks = await resolveApiKeyStore(apiRequest(`Bearer ${unreadable.key}`), {
      requiredScope: "read:store"
    });

    releaseConsole();
    check("a key that cannot be shown still authenticates", stillWorks.ok);

    // -------------------------------------------------------- deleting a key

    check(
      "one store cannot delete another store key by its id",
      (await deleteStoreApiKey(other.storeId, unreadable.record.id)) === null &&
        (await prisma.storeApiKey.count({ where: { id: unreadable.record.id } })) === 1
    );

    const deleted = await deleteStoreApiKey(primary.storeId, unreadable.record.id);

    check("deleting returns the key it removed", deleted?.id === unreadable.record.id);
    check(
      "the row is gone rather than marked",
      (await prisma.storeApiKey.count({ where: { id: unreadable.record.id } })) === 0
    );
    check(
      "deleting the same key twice is not an error",
      (await deleteStoreApiKey(primary.storeId, unreadable.record.id)) === null
    );

    resetAiAuditCoalescing();
    captureConsole();
    const afterDelete = await resolveApiKeyStore(apiRequest(`Bearer ${unreadable.key}`), {
      requiredScope: "read:store"
    });

    releaseConsole();
    check("a deleted key no longer authenticates", !afterDelete.ok);

    // ------------------------------------------------------------ a valid key

    resetAiAuditCoalescing();
    captureConsole();
    const valid = await resolveApiKeyStore(apiRequest(`Bearer ${issued.key}`), {
      requiredScope: "read:store"
    });
    releaseConsole();

    check("a valid key authenticates", valid.ok, valid.ok ? "" : valid.reason);
    check(
      "it resolves to exactly its own store",
      valid.ok && valid.identity.storeId === primary.storeId
    );
    check(
      "the granted scopes come back with the identity",
      valid.ok && valid.identity.scopes.includes("read:store")
    );
    check(
      "the identity carries the hint, never the key",
      valid.ok &&
        valid.identity.keyHint === issued.record.hint &&
        !JSON.stringify(valid.identity).includes(issued.key)
    );

    const touched = await prisma.storeApiKey.findUnique({ where: { id: issued.record.id } });

    check("a successful authentication records last-used", touched?.lastUsedAt !== null);

    // ---------------------------------------------------- the raw key in logs

    check(
      "the raw key never reaches the process log",
      !capturedLogs.some((line) => line.includes(issued.key)),
      capturedLogs.length > 0 ? `${capturedLogs.length} line(s) captured` : "no lines captured"
    );
    check(
      "the stored hash never reaches the process log",
      !capturedLogs.some((line) => line.includes(hashAiApiKey(issued.key)))
    );

    const auditRows = await prisma.systemLog.findMany({ where: { storeId: primary.storeId } });
    const auditJson = JSON.stringify(auditRows);

    check(
      "a successful authentication is audited",
      auditRows.length > 0,
      `${auditRows.length} row(s)`
    );
    check(
      "the audit rows are attributed to the API source",
      auditRows.every((row) => row.source === "API")
    );
    check("the raw key never reaches SystemLog", !auditJson.includes(issued.key));
    check("the stored hash never reaches SystemLog", !auditJson.includes(hashAiApiKey(issued.key)));

    // ------------------------------------------------------- an unknown key

    const neverIssued = createAiApiKey();

    captureConsole();
    const unknown = await resolveApiKeyStore(apiRequest(`Bearer ${neverIssued.key}`), {
      requiredScope: "read:store"
    });
    releaseConsole();

    check(
      "a well-formed key that was never issued is refused",
      !unknown.ok && unknown.reason === "unknown_key",
      unknown.ok ? "accepted" : unknown.reason
    );
    check(
      "an unknown key is told nothing about why",
      !unknown.ok && unknown.message === "Invalid API credentials."
    );

    // ------------------------------------------- missing / malformed headers

    // Header shapes, and the reason each must be refused with. The reason is
    // asserted rather than just "it failed", because it is what the audit trail
    // records: an integrator reading their log has to be able to tell a client
    // that was never configured from one configured wrongly.
    const headerCases = [
      { expected: "missing_credentials", header: null, label: "no header at all" },
      { expected: "missing_credentials", header: "", label: "an empty header" },
      { expected: "missing_credentials", header: "   ", label: "a whitespace header" },
      { expected: "malformed_credentials", header: "Bearer", label: "a scheme with no token" },
      { expected: "malformed_credentials", header: "Basic abcdef", label: "the wrong scheme" },
      {
        expected: "malformed_credentials",
        header: `Basic ${issued.key}`,
        label: "a real key under the wrong scheme"
      },
      { expected: "malformed_credentials", header: issued.key, label: "a bare key with no scheme" },
      {
        expected: "malformed_credentials",
        header: `Bearer ${issued.key} extra`,
        label: "a trailing second token"
      },
      {
        expected: "malformed_credentials",
        header: "Bearer sk_live_tooshort",
        label: "a truncated key"
      },
      {
        expected: "malformed_credentials",
        header: `Bearer sk_test_${"a".repeat(43)}`,
        label: "an unknown key prefix"
      }
    ] as const;

    captureConsole();
    const headerResults = await Promise.all(
      headerCases.map((testCase) =>
        resolveApiKeyStore(apiRequest(testCase.header), { requiredScope: "read:store" })
      )
    );
    releaseConsole();

    for (const [index, testCase] of headerCases.entries()) {
      const result = headerResults[index];

      check(
        `${testCase.label} is refused as ${testCase.expected}`,
        result !== undefined && !result.ok && result.reason === testCase.expected,
        result === undefined ? "no result" : result.ok ? "ACCEPTED" : result.reason
      );
    }

    check(
      "no header shape is ever accepted",
      headerResults.every((result) => !result.ok)
    );

    // ---------------------------------------------------- scope enforcement

    const narrow = await issueStoreApiKey(primary.storeId, {
      name: "Products only",
      scopes: ["read:products"]
    });

    captureConsole();
    const refusedScope = await resolveApiKeyStore(apiRequest(`Bearer ${narrow.key}`), {
      requiredScope: "read:store"
    });
    const allowedScope = await resolveApiKeyStore(apiRequest(`Bearer ${narrow.key}`), {
      requiredScope: "read:products"
    });
    const noScopeRequired = await resolveApiKeyStore(apiRequest(`Bearer ${narrow.key}`));
    releaseConsole();

    check(
      "a key without the required scope is refused",
      !refusedScope.ok && refusedScope.reason === "insufficient_scope",
      refusedScope.ok ? "accepted" : refusedScope.reason
    );
    check(
      "the refusal names the scope that was missing",
      !refusedScope.ok && refusedScope.message.includes("read:store")
    );
    check("the same key passes for a scope it does hold", allowedScope.ok);
    check("an endpoint that requires no scope still authenticates", noScopeRequired.ok);

    // ------------------------------------------------------ cross-store isolation

    const otherKey = await issueStoreApiKey(other.storeId, {
      name: "Other store",
      scopes: ["read:store"]
    });

    captureConsole();
    const crossStore = await Promise.all([
      resolveApiKeyStore(
        apiRequest(
          `Bearer ${issued.key}`,
          `https://app.storeim.com/api/ai/v1/context?storeId=${other.storeId}`
        ),
        { requiredScope: "read:store" }
      ),
      resolveApiKeyStore(apiRequest(`Bearer ${otherKey.key}`), { requiredScope: "read:store" })
    ]);
    releaseConsole();

    const [withForeignQueryParam, otherStoreKey] = crossStore;

    check(
      "a storeId in the query string does not change the tenant",
      withForeignQueryParam !== undefined &&
        withForeignQueryParam.ok &&
        withForeignQueryParam.identity.storeId === primary.storeId
    );

    // The same, through a header a caller might hope is trusted.
    const headerHeaders = new Headers();

    headerHeaders.set("authorization", `Bearer ${issued.key}`);
    headerHeaders.set("x-store-id", other.storeId);

    captureConsole();
    const withForeignHeader = await resolveApiKeyStore(
      new Request("https://app.storeim.com/api/ai/v1/context", { headers: headerHeaders }),
      { requiredScope: "read:store" }
    );
    releaseConsole();

    check(
      "an X-Store-Id header does not change the tenant",
      withForeignHeader.ok && withForeignHeader.identity.storeId === primary.storeId
    );
    check(
      "another store's key resolves only to that other store",
      otherStoreKey !== undefined &&
        otherStoreKey.ok &&
        otherStoreKey.identity.storeId === other.storeId
    );
    check(
      "one store cannot revoke another store's key",
      (await revokeStoreApiKey(other.storeId, issued.record.id)) === null
    );

    captureConsole();
    const survivedForeignRevoke = await resolveApiKeyStore(apiRequest(`Bearer ${issued.key}`));
    releaseConsole();

    check("the key another store tried to revoke still works", survivedForeignRevoke.ok);

    // ----------------------------------------------------------- revocation

    const revoked = await revokeStoreApiKey(primary.storeId, narrow.record.id);

    check("a key is revoked by its own store", revoked?.revokedAt instanceof Date);

    captureConsole();
    const afterRevoke = await resolveApiKeyStore(apiRequest(`Bearer ${narrow.key}`), {
      requiredScope: "read:products"
    });
    releaseConsole();

    check(
      "a revoked key is refused",
      !afterRevoke.ok && afterRevoke.reason === "revoked_key",
      afterRevoke.ok ? "accepted" : afterRevoke.reason
    );
    check(
      "revoking twice is not reported as a fresh revocation",
      (await revokeStoreApiKey(primary.storeId, narrow.record.id)) === null
    );

    // -------------------------------------------------------------- expiry

    const expiring = await issueStoreApiKey(primary.storeId, {
      expiresAt: new Date(Date.now() + 60_000),
      name: "Short lived",
      scopes: ["read:store"]
    });

    captureConsole();
    const beforeExpiry = await resolveApiKeyStore(apiRequest(`Bearer ${expiring.key}`), {
      requiredScope: "read:store"
    });
    releaseConsole();

    check("a key with a future expiry works", beforeExpiry.ok);

    await prisma.storeApiKey.update({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { id: expiring.record.id }
    });

    captureConsole();
    const afterExpiry = await resolveApiKeyStore(apiRequest(`Bearer ${expiring.key}`), {
      requiredScope: "read:store"
    });
    releaseConsole();

    check(
      "an expired key is refused",
      !afterExpiry.ok && afterExpiry.reason === "expired_key",
      afterExpiry.ok ? "accepted" : afterExpiry.reason
    );

    let pastExpiryRefused = false;

    try {
      await issueStoreApiKey(primary.storeId, {
        expiresAt: new Date(Date.now() - 60_000),
        name: "Already dead",
        scopes: ["read:store"]
      });
    } catch {
      pastExpiryRefused = true;
    }

    check("a key cannot be issued already expired", pastExpiryRefused);

    // ------------------------------------------------------ suspended store

    const suspendedKey = await issueStoreApiKey(suspended.storeId, {
      name: "Suspended store",
      scopes: ["read:store"]
    });

    captureConsole();
    const suspendedResult = await resolveApiKeyStore(apiRequest(`Bearer ${suspendedKey.key}`), {
      requiredScope: "read:store"
    });
    releaseConsole();

    check(
      "a suspended store's key is refused",
      !suspendedResult.ok && suspendedResult.reason === "store_unavailable",
      suspendedResult.ok ? "accepted" : suspendedResult.reason
    );

    // ------------------------------------------------------ context payload

    const context = await getAiStoreContext(primary.storeId, ["read:store"]);
    const expectedKeys = [
      "businessType",
      "country",
      "currency",
      "scopes",
      "slug",
      "storeId",
      "storeName",
      "timezone"
    ];

    check(
      "the context payload carries exactly the eight allow-listed fields",
      context !== null &&
        JSON.stringify(Object.keys(context).sort()) === JSON.stringify(expectedKeys),
      context ? Object.keys(context).sort().join(", ") : "null"
    );
    check(
      "the context payload describes the right store",
      context?.storeId === primary.storeId && context?.currency === "BDT"
    );
    check(
      "the context payload leaks no status, id chain or timestamps",
      context !== null && !("status" in context) && !("organizationId" in context)
    );
    check(
      "a context read for a store that is gone returns null",
      (await getAiStoreContext("missing", ["read:store"])) === null
    );
    check(
      "the context payload will not carry a scope outside the vocabulary",
      (() => {
        try {
          // Cast past the compiler on purpose: the runtime guarantee is what is
          // being asserted, because the value on the real path comes from a
          // database column rather than from TypeScript.
          aiStoreContextSchema.parse({
            businessType: "General Store",
            country: "BD",
            currency: "BDT",
            scopes: ["read:store", "read:everything"],
            slug: "x",
            storeId: "x",
            storeName: "x",
            timezone: "Asia/Dhaka"
          });

          return false;
        } catch {
          return true;
        }
      })()
    );

    // -------------------------------------------------------- rate limiting

    resetAiApiRateLimits();

    const bucket = `verify:${randomUUID()}`;
    let allowedCount = 0;

    for (let attempt = 0; attempt < 130; attempt += 1) {
      if (consumeAiApiToken(bucket).allowed) {
        allowedCount += 1;
      }
    }

    const exhausted = consumeAiApiToken(bucket);

    check(
      "the rate limiter caps a bucket at its capacity",
      allowedCount === 120,
      String(allowedCount)
    );
    check(
      "a refused request is told how long to wait",
      !exhausted.allowed && exhausted.retryAfterSeconds >= 1,
      String(exhausted.retryAfterSeconds)
    );
    check(
      "an untouched bucket starts full",
      consumeAiApiToken(`verify:${randomUUID()}`).remaining === 119
    );

    resetAiApiRateLimits();

    /* ==================================================================== */
    /*                    Phase 2 — the read endpoints                      */
    /* ==================================================================== */

    // Fixture data, deliberately carrying every field that must not come back:
    // a product with a cost price, an order with an IP address and a full fraud
    // assessment on it.
    const category = await prisma.category.create({
      data: {
        name: "AI Test Category",
        slug: `ai-cat-${suffix}`,
        storeId: primary.storeId
      }
    });

    for (let index = 0; index < 3; index += 1) {
      await prisma.product.create({
        data: {
          categoryId: category.id,
          compareAtPrice: "1500.00",
          // The one field the whole redaction layer exists for.
          costPrice: "600.50",
          images: {
            create: [{ alt: `Shot ${index}`, position: 0, url: `https://cdn.test/p${index}.jpg` }]
          },
          price: "1200.25",
          sku: `AI-SKU-${suffix}-${index}`,
          slug: `ai-product-${suffix}-${index}`,
          status: "ACTIVE",
          stockQuantity: 10 + index,
          storeId: primary.storeId,
          title: `AI Test Product ${index}`,
          visibility: "PUBLIC"
        }
      });
    }

    await prisma.product.create({
      data: {
        price: "999.00",
        slug: `other-product-${suffix}`,
        status: "ACTIVE",
        stockQuantity: 5,
        storeId: other.storeId,
        title: "Other Store Product",
        visibility: "PUBLIC"
      }
    });

    const fixtureOrder = await prisma.order.create({
      data: {
        currency: "BDT",
        customerEmail: "rahim.uddin@example.com",
        customerName: "Rahim Uddin",
        customerPhone: "01712345678",
        // Every one of these must be absent from the response.
        ipAddress: "203.0.113.9",
        items: {
          create: [
            {
              price: "1200.25",
              quantity: 2,
              sku: `AI-SKU-${suffix}-0`,
              title: "AI Test Product 0",
              total: "2400.50"
            }
          ]
        },
        orderNumber: `AI-${suffix}-1`,
        paymentStatus: "PAID",
        riskFactors: [{ code: "TEST_FACTOR", weight: 42 }],
        riskLevel: "HIGH",
        riskScore: 42,
        shippingArea: "Banani",
        shippingCity: "Dhaka",
        shippingDistrict: "Dhaka",
        status: "PENDING",
        storeId: primary.storeId,
        subtotalAmount: "2400.50",
        totalAmount: "2530.50"
      }
    });

    await prisma.order.create({
      data: {
        currency: "BDT",
        customerName: "Other Store Customer",
        customerPhone: "01898765432",
        orderNumber: `OTHER-${suffix}-1`,
        storeId: other.storeId,
        subtotalAmount: "100.00",
        totalAmount: "100.00"
      }
    });

    const readKey = await issueStoreApiKey(primary.storeId, {
      name: "Full read",
      scopes: ["read:analytics", "read:customers", "read:orders", "read:products", "read:store"]
    });
    const analyticsOnlyKey = await issueStoreApiKey(primary.storeId, {
      name: "Analytics only",
      scopes: ["read:analytics"]
    });
    const otherStoreReadKey = await issueStoreApiKey(other.storeId, {
      name: "Other store read",
      scopes: ["read:orders", "read:products"]
    });

    resetAiApiRateLimits();

    // ------------------------------------------------------------ products

    captureConsole();
    const products = await readRoute(
      await getProductsRoute(routeRequest(readKey.key, "/api/ai/v1/products"))
    );
    releaseConsole();

    const productBody = products.body as {
      data: Array<Record<string, unknown>>;
      page: { hasMore: boolean; nextCursor: string | null };
      storeId: string;
    };

    check(
      "GET /products answers 200 for a valid key",
      products.status === 200,
      String(products.status)
    );
    check(
      "it returns this store's products",
      productBody?.data?.length === 3,
      String(productBody?.data?.length)
    );
    check(
      "the response is scoped to the authenticated store",
      productBody?.storeId === primary.storeId
    );
    check(
      "a product carries exactly the allow-listed fields",
      JSON.stringify(Object.keys(productBody.data[0] ?? {}).sort()) ===
        JSON.stringify([
          "category",
          "compareAtPrice",
          "createdAt",
          "id",
          "images",
          "price",
          "sku",
          "slug",
          "status",
          "stockQuantity",
          "title",
          "updatedAt",
          "visibility"
        ]),
      Object.keys(productBody.data[0] ?? {})
        .sort()
        .join(", ")
    );
    check(
      "costPrice is nowhere in the products response",
      !products.raw.includes("costPrice") && !products.raw.includes("600.50")
    );
    check(
      "money is serialised as an exact string, not a float",
      productBody.data[0]?.price === "1200.25"
    );
    check(
      "no forbidden field appears in the products response",
      forbiddenFieldsIn(products.raw).length === 0,
      forbiddenFieldsIn(products.raw).join(", ")
    );

    // ----------------------------------------------------------- pagination

    captureConsole();
    const firstPage = await readRoute(
      await getProductsRoute(routeRequest(readKey.key, "/api/ai/v1/products?limit=2"))
    );
    const firstBody = firstPage.body as {
      data: Array<{ id: string }>;
      page: { hasMore: boolean; nextCursor: string | null };
    };
    const secondPage = await readRoute(
      await getProductsRoute(
        routeRequest(readKey.key, `/api/ai/v1/products?limit=2&cursor=${firstBody.page.nextCursor}`)
      )
    );
    const badLimit = await readRoute(
      await getProductsRoute(routeRequest(readKey.key, "/api/ai/v1/products?limit=5000"))
    );
    releaseConsole();

    const secondBody = secondPage.body as {
      data: Array<{ id: string }>;
      page: { hasMore: boolean };
    };

    check("a page honours ?limit", firstBody.data.length === 2, String(firstBody.data.length));
    check(
      "a full page reports hasMore and a cursor",
      firstBody.page.hasMore && firstBody.page.nextCursor !== null
    );
    check(
      "the next page returns the remaining rows",
      secondBody.data.length === 1,
      String(secondBody.data.length)
    );
    check("the last page reports no more", secondBody.page.hasMore === false);
    check(
      "pages do not overlap",
      !firstBody.data.some((row) => secondBody.data.some((next) => next.id === row.id))
    );
    check("an over-large ?limit is a 400", badLimit.status === 400, String(badLimit.status));

    // --------------------------------------------------------------- search

    captureConsole();
    const searched = await readRoute(
      await getProductsRoute(routeRequest(readKey.key, `/api/ai/v1/products?search=Product%201`))
    );
    const bySku = await readRoute(
      await getProductsRoute(
        routeRequest(readKey.key, `/api/ai/v1/products?search=AI-SKU-${suffix}-2`)
      )
    );
    releaseConsole();

    check(
      "?search matches a product title",
      (searched.body as { data: unknown[] }).data.length === 1,
      String((searched.body as { data: unknown[] }).data.length)
    );
    check(
      "?search matches a SKU",
      (bySku.body as { data: Array<{ sku: string }> }).data[0]?.sku === `AI-SKU-${suffix}-2`
    );

    // ---------------------------------------------------------------- orders

    captureConsole();
    const orders = await readRoute(
      await getOrdersRoute(routeRequest(readKey.key, "/api/ai/v1/orders"))
    );
    releaseConsole();

    const orderBody = orders.body as {
      data: Array<
        Record<string, unknown> & { customer: Record<string, unknown>; items: unknown[] }
      >;
      storeId: string;
    };
    const firstOrder = orderBody.data[0];

    check("GET /orders answers 200", orders.status === 200, String(orders.status));
    check(
      "it returns this store's orders only",
      orderBody.data.length === 1,
      String(orderBody.data.length)
    );
    check(
      "an order carries exactly the allow-listed fields",
      JSON.stringify(Object.keys(firstOrder ?? {}).sort()) ===
        JSON.stringify([
          "createdAt",
          "currency",
          "customer",
          "id",
          "items",
          "orderNumber",
          "paymentStatus",
          "shipping",
          "status",
          "storeId",
          "totalAmount"
        ]),
      Object.keys(firstOrder ?? {})
        .sort()
        .join(", ")
    );
    check(
      "orderNumber always travels with its store",
      firstOrder?.orderNumber === `AI-${suffix}-1` && firstOrder?.storeId === primary.storeId
    );
    check("the customer's name is kept", firstOrder?.customer?.name === "Rahim Uddin");
    check(
      "the customer's phone is masked to the last four digits",
      firstOrder?.customer?.phone === "•••••••5678",
      String(firstOrder?.customer?.phone)
    );
    check(
      "the customer's email is masked but keeps its domain",
      firstOrder?.customer?.email === "r••••••••••@example.com",
      String(firstOrder?.customer?.email)
    );
    check("the full phone number never appears", !orders.raw.includes("01712345678"));
    check("the full email never appears", !orders.raw.includes("rahim.uddin@example.com"));
    check(
      "shipping is reduced to city and district",
      JSON.stringify(firstOrder?.shipping) === JSON.stringify({ city: "Dhaka", district: "Dhaka" })
    );
    check("the street-level area is not sent", !orders.raw.includes("Banani"));
    check("the order's IP address is not sent", !orders.raw.includes("203.0.113.9"));
    check("the fraud assessment is not sent", !orders.raw.includes("TEST_FACTOR"));
    check(
      "no forbidden field appears in the orders response",
      forbiddenFieldsIn(orders.raw).length === 0,
      forbiddenFieldsIn(orders.raw).join(", ")
    );
    check(
      "line items carry title, sku, quantity and price",
      JSON.stringify(Object.keys((firstOrder?.items?.[0] as object) ?? {}).sort()) ===
        JSON.stringify(["id", "price", "productId", "quantity", "sku", "title", "total"]),
      Object.keys((firstOrder?.items?.[0] as object) ?? {})
        .sort()
        .join(", ")
    );

    // --------------------------------------------------------------- metrics

    captureConsole();
    const metrics = await readRoute(
      await getMetricsRoute(routeRequest(readKey.key, "/api/ai/v1/metrics"))
    );
    releaseConsole();

    const metricsBody = metrics.body as {
      currency: string;
      storeId: string;
      summary: Record<string, unknown>;
    };

    check("GET /metrics answers 200", metrics.status === 200, String(metrics.status));
    check("metrics are scoped to the authenticated store", metricsBody.storeId === primary.storeId);
    check("metrics report the store's currency", metricsBody.currency === "BDT");
    check(
      "metrics count this store's products",
      metricsBody.summary?.totalProducts === 3,
      String(metricsBody.summary?.totalProducts)
    );
    check(
      "metrics count this store's orders",
      metricsBody.summary?.totalOrders === 1,
      String(metricsBody.summary?.totalOrders)
    );
    check(
      "no forbidden field appears in the metrics response",
      forbiddenFieldsIn(metrics.raw).length === 0,
      forbiddenFieldsIn(metrics.raw).join(", ")
    );

    // --------------------------------------------------------------- reports

    captureConsole();
    const reportResults = await Promise.all(
      AI_REPORT_KEYS.map(async (key) => ({
        key,
        result: await readRoute(
          await getReportRoute(routeRequest(readKey.key, `/api/ai/v1/reports/${key}`), {
            params: Promise.resolve({ reportKey: key })
          })
        )
      }))
    );
    const unknownReport = await readRoute(
      await getReportRoute(routeRequest(readKey.key, "/api/ai/v1/reports/everything"), {
        params: Promise.resolve({ reportKey: "everything" })
      })
    );
    const badRange = await readRoute(
      await getReportRoute(routeRequest(readKey.key, "/api/ai/v1/reports/overview?range=6m"), {
        params: Promise.resolve({ reportKey: "overview" })
      })
    );
    const rangedReport = await readRoute(
      await getReportRoute(routeRequest(readKey.key, "/api/ai/v1/reports/revenues?range=12m"), {
        params: Promise.resolve({ reportKey: "revenues" })
      })
    );
    releaseConsole();

    check(
      "every report key answers 200",
      reportResults.every(({ result }) => result.status === 200),
      reportResults
        .filter(({ result }) => result.status !== 200)
        .map(({ key, result }) => `${key}:${result.status}`)
        .join(", ")
    );
    check(
      "every report is scoped to the authenticated store",
      reportResults.every(
        ({ result }) => (result.body as { storeId: string }).storeId === primary.storeId
      )
    );
    check(
      "no forbidden field appears in any report",
      reportResults.every(({ result }) => forbiddenFieldsIn(result.raw).length === 0),
      reportResults
        .flatMap(({ key, result }) =>
          forbiddenFieldsIn(result.raw).map((field) => `${key}:${field}`)
        )
        .join(", ")
    );
    check(
      "an unknown report key is a 404",
      unknownReport.status === 404,
      String(unknownReport.status)
    );
    check(
      "the 404 names the reports that do exist",
      (unknownReport.body as { code: string; message: string }).code === "unknown_report" &&
        (unknownReport.body as { message: string }).message.includes("overview")
    );
    check("an unsupported ?range is a 400", badRange.status === 400, String(badRange.status));
    check(
      "a supported ?range is honoured",
      rangedReport.status === 200 && (rangedReport.body as { range: string }).range === "12m",
      String((rangedReport.body as { range: string }).range)
    );

    // -------------------------------------------------------- scope enforcement

    captureConsole();
    const scopeChecks = {
      analyticsKeyOnMetrics: await readRoute(
        await getMetricsRoute(routeRequest(analyticsOnlyKey.key, "/api/ai/v1/metrics"))
      ),
      analyticsKeyOnOrders: await readRoute(
        await getOrdersRoute(routeRequest(analyticsOnlyKey.key, "/api/ai/v1/orders"))
      ),
      analyticsKeyOnProducts: await readRoute(
        await getProductsRoute(routeRequest(analyticsOnlyKey.key, "/api/ai/v1/products"))
      ),
      analyticsKeyOnRevenues: await readRoute(
        await getReportRoute(routeRequest(analyticsOnlyKey.key, "/api/ai/v1/reports/revenues"), {
          params: Promise.resolve({ reportKey: "revenues" })
        })
      ),
      analyticsKeyOnCustomers: await readRoute(
        await getReportRoute(routeRequest(analyticsOnlyKey.key, "/api/ai/v1/reports/customers"), {
          params: Promise.resolve({ reportKey: "customers" })
        })
      )
    };
    releaseConsole();

    check(
      "a key without read:products is refused by /products",
      scopeChecks.analyticsKeyOnProducts.status === 403,
      String(scopeChecks.analyticsKeyOnProducts.status)
    );
    check(
      "a key without read:orders is refused by /orders",
      scopeChecks.analyticsKeyOnOrders.status === 403,
      String(scopeChecks.analyticsKeyOnOrders.status)
    );
    check(
      "a key with read:analytics reaches /metrics",
      scopeChecks.analyticsKeyOnMetrics.status === 200
    );
    check(
      "read:analytics alone reaches a report that names nobody",
      scopeChecks.analyticsKeyOnRevenues.status === 200,
      String(scopeChecks.analyticsKeyOnRevenues.status)
    );
    check(
      "read:analytics alone is refused a report that names customers",
      scopeChecks.analyticsKeyOnCustomers.status === 403,
      String(scopeChecks.analyticsKeyOnCustomers.status)
    );
    check(
      "that refusal says which scope is missing",
      (scopeChecks.analyticsKeyOnCustomers.body as { message: string }).message.includes(
        "read:customers"
      )
    );

    // ------------------------------------------------- cross-store isolation

    captureConsole();
    const foreignQueryParam = await readRoute(
      await getProductsRoute(
        routeRequest(readKey.key, `/api/ai/v1/products?storeId=${other.storeId}`)
      )
    );
    const foreignHeaders = new Headers();

    foreignHeaders.set("authorization", `Bearer ${readKey.key}`);
    foreignHeaders.set("x-store-id", other.storeId);

    const foreignHeader = await readRoute(
      await getOrdersRoute(
        new NextRequest("https://app.storeim.com/api/ai/v1/orders", { headers: foreignHeaders })
      )
    );
    const otherStoreProducts = await readRoute(
      await getProductsRoute(routeRequest(otherStoreReadKey.key, "/api/ai/v1/products"))
    );
    const otherStoreOrders = await readRoute(
      await getOrdersRoute(routeRequest(otherStoreReadKey.key, "/api/ai/v1/orders"))
    );
    const revokedOnProducts = await readRoute(
      await getProductsRoute(routeRequest(narrow.key, "/api/ai/v1/products"))
    );
    const expiredOnProducts = await readRoute(
      await getProductsRoute(routeRequest(expiring.key, "/api/ai/v1/products"))
    );
    const suspendedOnProducts = await readRoute(
      await getProductsRoute(routeRequest(suspendedKey.key, "/api/ai/v1/products"))
    );
    const unknownOnProducts = await readRoute(
      await getProductsRoute(routeRequest(neverIssued.key, "/api/ai/v1/products"))
    );
    const noHeaderOnProducts = await readRoute(
      await getProductsRoute(new NextRequest("https://app.storeim.com/api/ai/v1/products"))
    );
    releaseConsole();

    check(
      "?storeId does not move a products read to another store",
      foreignQueryParam.status === 200 &&
        (foreignQueryParam.body as { storeId: string }).storeId === primary.storeId
    );
    check(
      "an X-Store-Id header does not move an orders read either",
      foreignHeader.status === 200 &&
        (foreignHeader.body as { storeId: string }).storeId === primary.storeId
    );
    check(
      "another store's key sees only its own product",
      (otherStoreProducts.body as { data: Array<{ title: string }> }).data.length === 1 &&
        (otherStoreProducts.body as { data: Array<{ title: string }> }).data[0]?.title ===
          "Other Store Product"
    );
    check(
      "another store's key never sees this store's orders",
      !otherStoreOrders.raw.includes("Rahim Uddin") &&
        !otherStoreOrders.raw.includes(fixtureOrder.id)
    );
    check(
      "a revoked key is refused by /products",
      revokedOnProducts.status === 401,
      String(revokedOnProducts.status)
    );
    check(
      "an expired key is refused by /products",
      expiredOnProducts.status === 401,
      String(expiredOnProducts.status)
    );
    check(
      "a suspended store's key is refused by /products",
      suspendedOnProducts.status === 403,
      String(suspendedOnProducts.status)
    );
    check(
      "an unknown key is refused by /products",
      unknownOnProducts.status === 401,
      String(unknownOnProducts.status)
    );
    check(
      "a missing header is refused by /products",
      noHeaderOnProducts.status === 401,
      String(noHeaderOnProducts.status)
    );

    /* ==================================================================== */
    /*        Phase 5.2 — /context reports the key's granted scopes          */
    /* ==================================================================== */

    const storeOnlyKey = await issueStoreApiKey(primary.storeId, {
      name: "Store profile only",
      scopes: ["read:store"]
    });
    const otherStoreContextKey = await issueStoreApiKey(other.storeId, {
      name: "Other store context",
      scopes: ["read:products", "read:store"]
    });

    captureConsole();
    const contextA = await readRoute(
      await getContextRoute(routeRequest(readKey.key, "/api/ai/v1/context"))
    );
    const contextStoreOnly = await readRoute(
      await getContextRoute(routeRequest(storeOnlyKey.key, "/api/ai/v1/context"))
    );
    const contextB = await readRoute(
      await getContextRoute(routeRequest(otherStoreContextKey.key, "/api/ai/v1/context"))
    );
    const contextWithForeignSelectors = await readRoute(
      await getContextRoute(
        new NextRequest(
          `https://app.storeim.com/api/ai/v1/context?storeId=${other.storeId}&tenantId=${other.storeId}&siteId=${other.storeId}&scopes=write:products`,
          {
            headers: new Headers({
              authorization: `Bearer ${storeOnlyKey.key}`,
              "x-store-id": other.storeId
            })
          }
        )
      )
    );
    releaseConsole();

    type ContextBody = {
      businessType: string;
      country: string;
      currency: string;
      scopes: string[];
      slug: string;
      storeId: string;
      storeName: string;
      timezone: string;
    };

    const bodyA = contextA.body as ContextBody;
    const bodyStoreOnly = contextStoreOnly.body as ContextBody;
    const bodyB = contextB.body as ContextBody;
    const bodyForeign = contextWithForeignSelectors.body as ContextBody;

    check("GET /context still answers 200 and JSON", contextA.status === 200 && bodyA !== null);
    check("the context response now carries scopes", Array.isArray(bodyA.scopes));
    check(
      "the scopes are the ones granted to that key",
      JSON.stringify(bodyA.scopes) ===
        JSON.stringify([
          "read:analytics",
          "read:customers",
          "read:orders",
          "read:products",
          "read:store"
        ]),
      JSON.stringify(bodyA.scopes)
    );
    check(
      "a key granted only read:store reports only read:store",
      JSON.stringify(bodyStoreOnly.scopes) === JSON.stringify(["read:store"]),
      JSON.stringify(bodyStoreOnly.scopes)
    );
    check(
      "two keys on the same store report their own scopes, not each other's",
      bodyA.scopes.length === 5 &&
        bodyStoreOnly.scopes.length === 1 &&
        !bodyStoreOnly.scopes.includes("read:orders")
    );
    check(
      "key B reports key B's scopes",
      JSON.stringify(bodyB.scopes) === JSON.stringify(["read:products", "read:store"]),
      JSON.stringify(bodyB.scopes)
    );
    check(
      "key A's scopes never appear when authenticated as key B",
      !bodyB.scopes.includes("read:analytics") &&
        !bodyB.scopes.includes("read:customers") &&
        !bodyB.scopes.includes("read:orders")
    );
    check(
      "the store on the response is still key B's own store",
      bodyB.storeId === other.storeId && bodyA.storeId === primary.storeId
    );
    check(
      "the seven existing context fields are unchanged",
      bodyA.businessType === "Beauty Store" &&
        bodyA.country === "BD" &&
        bodyA.currency === "BDT" &&
        bodyA.storeId === primary.storeId &&
        bodyA.timezone === "Asia/Dhaka" &&
        typeof bodyA.slug === "string" &&
        typeof bodyA.storeName === "string"
    );
    check(
      "no tenant selector in the query, and no X-Store-Id, moves the store",
      contextWithForeignSelectors.status === 200 && bodyForeign.storeId === primary.storeId,
      bodyForeign.storeId === primary.storeId ? "" : bodyForeign.storeId
    );
    check(
      "a ?scopes= parameter cannot widen what the key was granted",
      JSON.stringify(bodyForeign.scopes) === JSON.stringify(["read:store"]),
      JSON.stringify(bodyForeign.scopes)
    );
    check(
      "no forbidden field appears in the context response",
      forbiddenFieldsIn(contextA.raw).length === 0,
      forbiddenFieldsIn(contextA.raw).join(", ")
    );

    // A scope that is not in the vocabulary, written straight into the column so
    // it bypasses issuance validation — the shape a stale row would have after a
    // scope was removed from the code. It must not reach the response.
    await prisma.storeApiKey.update({
      data: { scopes: ["read:store", "read:everything", "admin:*"] },
      where: { id: storeOnlyKey.record.id }
    });

    captureConsole();
    const contextWithJunkScope = await readRoute(
      await getContextRoute(routeRequest(storeOnlyKey.key, "/api/ai/v1/context"))
    );
    releaseConsole();

    check(
      "an unrecognised stored scope is filtered out rather than echoed",
      contextWithJunkScope.status === 200 &&
        JSON.stringify((contextWithJunkScope.body as ContextBody).scopes) ===
          JSON.stringify(["read:store"]),
      JSON.stringify((contextWithJunkScope.body as ContextBody).scopes)
    );
    check(
      "the unrecognised scope never appears in the body",
      !contextWithJunkScope.raw.includes("read:everything") &&
        !contextWithJunkScope.raw.includes("admin:*")
    );

    // ------------------------------------------- rate limiting, through a route

    resetAiApiRateLimits();
    captureConsole();

    // Its own address, so this does not spend the budget the checks above used.
    let limitedStatus = 0;
    let allowedThroughRoute = 0;

    for (let attempt = 0; attempt < 130; attempt += 1) {
      const response = await getContextRoute(
        routeRequest(readKey.key, "/api/ai/v1/context", "198.51.100.7")
      );

      if (response.status === 200) {
        allowedThroughRoute += 1;
      } else {
        limitedStatus = response.status;
        break;
      }
    }

    const throttled = await getContextRoute(
      routeRequest(readKey.key, "/api/ai/v1/context", "198.51.100.7")
    );
    releaseConsole();

    check(
      "a route stops answering once the bucket is empty",
      limitedStatus === 429 && allowedThroughRoute === 120,
      `${allowedThroughRoute} allowed, then ${limitedStatus}`
    );
    check(
      "a throttled response carries Retry-After",
      throttled.headers.get("retry-after") !== null
    );
    check(
      "a throttled response says why",
      (JSON.parse(await throttled.text()) as { code: string }).code === "rate_limited"
    );

    resetAiApiRateLimits();

    // ------------------------------------------ the raw key still never leaks

    captureConsole();
    const finalContext = await readRoute(
      await getContextRoute(routeRequest(readKey.key, "/api/ai/v1/context"))
    );
    releaseConsole();

    const everyBody = [products.raw, orders.raw, metrics.raw, finalContext.raw]
      .concat(reportResults.map(({ result }) => result.raw))
      .join("\n");

    check("no response body ever contains a raw API key", !everyBody.includes(readKey.key));
    check(
      "no response body contains a stored hash",
      !everyBody.includes(hashAiApiKey(readKey.key))
    );
    check(
      "no forbidden field appears in any successful response",
      forbiddenFieldsIn(everyBody).length === 0,
      forbiddenFieldsIn(everyBody).join(", ")
    );
    check(
      "the Phase 2 requests never wrote a raw key to the log",
      !capturedLogs.some((line) => line.includes(readKey.key))
    );
  } finally {
    releaseConsole();
    await destroyFixture(primary);
    await destroyFixture(other);
    await destroyFixture(suspended);
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    releaseConsole();
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
