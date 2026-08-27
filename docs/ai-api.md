# The AI API (`/api/ai/v1/**`)

The machine-to-machine surface StoreOS AI calls to read a store. It is the only
way an external system is given access to commerce data: no database
credentials, no session cookies, no server actions.

This document covers credentials, authentication, scopes and tenancy, the five
read endpoints that exist today, and the rules everything added later has to
keep. Everything on this API is **read-only**: there is no endpoint that changes
anything in a store, and no scope that could be granted to reach one.

---

## Why an API at all

Three alternatives were considered and ruled out:

| Rejected                                                  | Why                                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Give StoreOS a Postgres connection                        | Tenant isolation in this codebase is entirely application-layer. There is no row-level security, so a direct connection has no tenant boundary at all.    |
| Expose the existing server actions                        | `"use server"` actions are cookie- and CSRF-bound and addressed by an encrypted action id. They are not callable by a server that has no browser session. |
| Reuse the session-cookie REST routes (`/api/products`, …) | Same problem: they authenticate a signed-in human via `getCurrentStore()`. A partner integration has no cookie to send.                                   |

So: a bearer credential that resolves to exactly one store, and endpoints that
delegate to the store-scoped services the rest of the app already uses.

---

## Versioning

Every path is `/api/ai/v1/…`. The version is in the URL rather than a header
because it is the first external contract this codebase has ever offered, and a
partner integration should be able to pin it by copying a base URL.

`v1` may gain endpoints and may add fields to a response. It will not remove or
rename a field. Anything that would is a `v2` mounted alongside it.

`/api/**` is excluded from the proxy matcher in [`apps/web/src/proxy.ts`](../apps/web/src/proxy.ts),
so these routes answer identically on the app host, a tenant subdomain, and a
custom domain. StoreOS AI is given one base URL and never has to care which
hostname resolves where.

---

## API key lifecycle

### Issue

**Dashboard → Settings → Integrations**, or `issueStoreApiKey(storeId, { name,
scopes, expiresAt? })` in
[`ai-key.service.ts`](../apps/web/src/modules/ai/ai-key.service.ts) directly.

The page is manager-only for writes and readable by a member: issuing a
credential that can read the whole catalogue and order book is an integration
change, the same class of act as reconnecting StoreOS itself, so
`createAiApiKeyAction` and `revokeAiApiKeyAction` both go through
`requireStoreManager()`. A member can still see which keys exist and when each
was last used, which is what they need when something has stopped working. The
form renders disabled for them, and the actions re-check for themselves — a
disabled input is not a permission check.

Only grantable scopes are sent to the browser at all, so a write scope is not a
checkbox somebody has to be stopped from ticking.

```
sk_live_<43 characters of base64url>
```

- 32 cryptographically random bytes (`randomBytes`), 256 bits of entropy.
- The prefix is there so the value is self-describing: secret scanners key on
  prefixes, and a seller who finds one in a config file can tell what it opens.
  `live` leaves room for an `sk_test_` band later without changing the parser.
- **The raw key is returned exactly once, by the call that creates it.** It is
  never written to the database, never logged, and cannot be recovered. Losing it
  means revoking and issuing another.

What reaches the database is:

| Column      | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| `tokenHash` | SHA-256 of the raw key, hex, `@unique`                           |
| `hint`      | the last four characters, so settings can say which key is which |
| `scopes`    | the granted scopes, sorted and de-duplicated                     |
| `expiresAt` | optional; must be in the future at issuance                      |

Plain SHA-256 rather than bcrypt, for the reason
[`staff-token.ts`](../apps/web/src/modules/staff/staff-token.ts) gives for invite
tokens: the input is 256 random bits, so there is no dictionary to slow down, and
authentication has to be one indexed equality query rather than a scan-and-compare
over every key in the table.

### Use

`Authorization: Bearer sk_live_…`, and nowhere else. A key is never read from a
query string — those end up in access logs, in `Referer`, and in browser history.

### Revoke

The Revoke button on the Integrations page, behind the same confirmation dialog
every destructive action in this dashboard uses, or
`revokeStoreApiKey(storeId, apiKeyId)`. Immediate: `revokedAt` is read on every
authentication rather than cached anywhere, so the next request fails.

Revocation is store-scoped in the same statement that writes, so one store cannot
revoke another's key by guessing an id. A key that does not belong to the caller
and a key that was already revoked both return `null` — indistinguishable, which
is what stops one store probing another's key ids.

### Expire

Optional. An expired key is refused with `expired_key`; nothing sweeps the row,
because the record of a key that once existed is worth keeping.

### Rotate

Issue the new key, deploy it, revoke the old one. There is no in-place rotation:
overlapping keys are what makes a rotation zero-downtime.

---

## Authentication flow

[`resolveApiKeyStore(request, { requiredScope })`](../apps/web/src/modules/ai/ai-auth.ts)
is the only implementation. It is a pure function of a `Request` — no
`NextResponse`, no redirects — which makes it the machine-to-machine twin of
`requireStore()` rather than a copy of it.

```
  Authorization header
        │
        ├─ absent / blank ─────────────────────► missing_credentials      401
        │
        ├─ not "Bearer <one token>", or not
        │  sk_live_ + 43 base64url characters ─► malformed_credentials    401
        │
        ▼
  SHA-256 the presented key
        │
        ▼
  findApiKeyByTokenHash()   ← one indexed equality query, joins Store(id, status)
        │
        ├─ no row ─────────────────────────────► unknown_key              401
        ├─ timingSafeEqual mismatch ───────────► unknown_key              401
        ├─ revokedAt set ──────────────────────► revoked_key              401
        ├─ expiresAt in the past ──────────────► expired_key              401
        ├─ store SUSPENDED / ARCHIVED ─────────► store_unavailable        403
        ├─ requiredScope not granted ──────────► insufficient_scope       403
        │
        ▼
  { storeId, scopes, keyId, keyName, keyHint }
```

`missing_credentials`, `malformed_credentials` and `unknown_key` all answer with
the same body — code `invalid_credentials`, message "Invalid API credentials." —
because the three are indistinguishable to anyone who does not already hold a
real key, and keeping them so means a guess reveals nothing about how close it
was. The distinct _reasons_ still reach the audit trail, where an integrator
debugging their own client needs them.

`revoked_key` and `expired_key` do say so. Presenting a key whose hash matches a
row proves you hold that key, so there is nothing left to disclose, and "your key
was revoked" is the answer that saves an integrator an afternoon.

### On `timingSafeEqual`

The lookup already matched on a unique column, and the values compared are
SHA-256 digests rather than the secret itself — an attacker cannot walk a timing
signal back through the hash, and the database lookup was not constant-time
anyway. The comparison is belt and braces: it is there so this file never
contains a bare equality between a stored and a presented credential for someone
to copy somewhere it would matter.

### HTTP shaping

Routes never call `resolveApiKeyStore` directly. They wrap their work in
[`withAiApiRoute`](../apps/web/src/modules/ai/ai-route.ts), which does
authentication, scope enforcement, throttling, error shaping, `cache-control:
no-store` and the rate-limit headers — so a route handler is the endpoint's
actual work and nothing else, and authentication has exactly one implementation.

---

## Tenant resolution

**One rule, and everything else follows from it:**

> `storeId` comes from the authenticated API key row and from nowhere else.

`resolveApiKeyStore` never reads a query parameter, a body field, or an
`X-Store-Id` header. A caller may send whatever they like alongside their
credentials; it is ignored. The verification script asserts this directly — a
request carrying `?storeId=<another store>` and `X-Store-Id: <another store>`
still resolves to the key's own store.

From there, `identity.storeId` is passed to the existing store-scoped services,
which are already the layer that enforces tenancy for the whole application. The
AI API does not re-implement isolation; it inherits it.

A store that is `SUSPENDED` or `ARCHIVED` is refused. Suspension is a platform
decision and has to bind every door, this one included. `DRAFT` is allowed — a
seller still setting up is a legitimate caller.

---

## Scope model

Declared in [`ai.schema.ts`](../apps/web/src/modules/ai/ai.schema.ts), stored on
`StoreApiKey.scopes` as plain strings so adding one is a code change rather than a
migration.

| Scope             | Grants                                                                  | Grantable today |
| ----------------- | ----------------------------------------------------------------------- | --------------- |
| `read:store`      | store identity — name, slug, currency, country, timezone, business type | ✅              |
| `read:products`   | catalog reads                                                           | ✅              |
| `read:orders`     | order reads                                                             | ✅              |
| `read:customers`  | customer reads                                                          | ✅              |
| `read:analytics`  | dashboard metrics and reports                                           | ✅              |
| `write:products`  | catalog writes                                                          | ❌ not yet      |
| `write:orders`    | order writes                                                            | ❌ not yet      |
| `write:marketing` | campaign writes                                                         | ❌ not yet      |

The write verbs exist in the vocabulary so the model, the docs and the storage
format are settled before the first write endpoint lands. **They cannot be
granted yet**, and key issuance refuses them: a scope nothing enforces is a
permission that silently means nothing, and issuing one would leave the seller
believing they had limited the AI when they had not.

To enable one later: implement the endpoint that requires it, then move the scope
out of `AI_WRITE_SCOPES`. That is the whole change.

Which endpoint needs what:

| Endpoint                                                                           | Requires                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `GET /context`                                                                     | `read:store`                              |
| `GET /products`                                                                    | `read:products`                           |
| `GET /orders`                                                                      | `read:orders`                             |
| `GET /metrics`                                                                     | `read:analytics`                          |
| `GET /reports/{revenues,products,incomplete-orders,abandoned-carts,merchandising}` | `read:analytics`                          |
| `GET /reports/{overview,orders,customers}`                                         | `read:analytics` **and** `read:customers` |

That last row is the only compound requirement, and it is deliberate. Three
reports name individual customers — `overview` and `customers` list top
customers, `orders` lists recent orders by customer name. A revenue chart and a
list of a store's best customers are not the same disclosure, so a key granted
only analytics access cannot reach customer names by asking for a different
report key. The table lives in `AI_REPORT_EXTRA_SCOPES`.

---

## Rate limiting — and its limitation

[`ai-rate-limit.ts`](../apps/web/src/modules/ai/ai-rate-limit.ts) is a per-process
token bucket, 120 requests per minute, in two namespaces: by client address
before authentication (so guessing at keys costs the guesser something) and by
key id after (so one key cannot spend a shared egress IP's whole budget). The
effective ceiling is whichever is tighter.

**It is not a production-grade distributed limiter and must not be described as
one.** State lives in one process's memory, so:

- N app instances allow N times the configured rate;
- a deploy resets every bucket to full;
- it therefore cannot enforce a billing quota, and nothing downstream should
  treat it as if it could.

What it does buy — which is the failure mode that actually happens here — is a
ceiling on a runaway agent loop or a retry storm from one caller hammering a
single instance. A stronger guarantee needs shared state (Redis, or a Postgres
table), which would be a new infrastructure dependency. The abstraction is shaped
for that swap: `consumeAiApiToken` is the only entry point and returns a decision
object rather than a boolean, so replacing the body changes that file and nothing
else.

Until then, put a limiter in front of the app — Caddy's `rate_limit` on
`/api/ai/*` is the cheapest option given [`deploy/Caddyfile`](../deploy/Caddyfile)
is already the edge.

---

## Audit logging

Every authentication attempt is logged to the process log. Attempts that are
attributable to a real key also reach `SystemLog` with `source: "API"` and the
store id, so a seller can see what their key did.

**Never logged, anywhere:** the raw key, the `Authorization` header, `tokenHash`,
or any credential. The audit function is only ever handed the key's id, its last
four characters, the outcome and the client address — the raw key never reaches
it, so it cannot leak by accident.

Two deliberate limits:

- **Unattributable failures** — missing, malformed and unknown credentials — go
  to the process log only, never to `SystemLog`. An unauthenticated caller must
  not be able to write unbounded rows into the database.
- **`SystemLog` writes are coalesced** to one row per (key, outcome) per 15
  minutes. `SystemLog` is the admin-facing system journal, not an access log: a
  row per successful request would bury every other event in it, and the holder
  of one revoked key could otherwise grow the table at will. Every attempt is
  still in the process log; the durable record is a summary.

---

## Security rules

The API will never:

- expose Prisma, a query builder, or any generic "run this SQL" endpoint;
- expose arbitrary model fields — every response is an explicit allow-listed
  object, parsed by its Zod schema on the way out, so a column added to `Store`
  next month cannot leak by being picked up in a spread;
- accept a store id from request input as tenant identity;
- expose credentials, secrets, or any `*Cipher` / `*Secret` column;
- expose password hashes, session tokens, OAuth tokens, or OTP challenges;
- expose admin or platform data — plans, subscriptions, payments, cross-tenant
  `SystemLog`;
- expose `costPrice`, `ipAddress`, or anything the fraud engine writes
  (`riskScore`, `riskLevel`, `riskFactors`, `verificationStatus`);
- send a full phone number, email address, or street address;
- bypass the existing store-scoped services;
- offer arbitrary tool or action execution.

One structural rule enforces most of this: **only
[`ai-key.repository.ts`](../apps/web/src/modules/ai/ai-key.repository.ts) may
import Prisma inside `modules/ai/`.** Credential storage is the one thing no other
module owns. Everything else — every byte of commerce data — is read through the
existing services and repositories, which is what keeps the tenant guarantees the
rest of the codebase already enforces from having to be re-implemented, badly,
for one external consumer.

### The shape every endpoint keeps

```
StoreOS AI
  → /api/ai/v1/*                      route handler: one call, no logic
  → withAiApiRoute()                  auth, scope, throttle, error shaping
  → resolveApiKeyStore()              storeId from the key, never the request
  → ai-*.service.ts                   redaction: explicit field-by-field DTO
  → existing DashCommerce service     product / order / analytics / report
  → existing store-scoped repository  the only thing that touches Prisma
  → Zod parse                         the allow-list, enforced at runtime
  → StoreOS AI
```

The AI module is a transport, auth and redaction layer. It holds no data layer of
its own: there is no second product repository, no second order query, no second
analytics engine. Where pagination was needed and the existing repositories had
none, the paginated read was added _to those repositories_
(`getProductPageForStore`, `getOrderPageForStore`) beside the reads the dashboard
already uses — so both surfaces still go through one place, with one set of
tenant rules.

---

## Endpoint reference

### `GET /api/ai/v1/context`

Requires `read:store`.

```http
GET /api/ai/v1/context HTTP/1.1
Host: app.storeim.com
Authorization: Bearer sk_live_…
```

```json
{
  "storeId": "clx…",
  "storeName": "Worzen",
  "slug": "worzen",
  "currency": "BDT",
  "country": "BD",
  "timezone": "Asia/Dhaka",
  "businessType": "Beauty Store"
}
```

Deliberately the smallest payload that is worth anything: it is how StoreOS AI
proves a key works, learns which shop it is talking to, and learns the currency
and timezone it must format everything else in. No counts, no customers, no
money.

### `GET /api/ai/v1/products`

Requires `read:products`. Query: `limit` (1–100, default 25), `cursor`, `search`
(matches title or SKU), `status` (`ACTIVE` / `DRAFT` / `ARCHIVED`).

```json
{
  "data": [
    {
      "id": "clx…",
      "title": "Argan Hair Oil 100ml",
      "slug": "argan-hair-oil-100ml",
      "sku": "AR-100",
      "price": "1200.25",
      "compareAtPrice": "1500.00",
      "stockQuantity": 14,
      "status": "ACTIVE",
      "visibility": "PUBLIC",
      "category": { "id": "clx…", "name": "Hair care", "slug": "hair-care" },
      "images": [{ "url": "https://…", "alt": "Front", "position": 0 }],
      "createdAt": "2026-08-01T09:12:04.000Z",
      "updatedAt": "2026-08-20T11:40:55.000Z"
    }
  ],
  "page": { "hasMore": true, "nextCursor": "clx…" },
  "storeId": "clx…"
}
```

**`costPrice` is never returned.** It is the seller's margin and it is not in the
mapper. Neither are `description`, `lowStockThreshold`, `isDemoContent`,
`demoPackId` or `searchVector`.

Money is a **string**, following the convention `analytics.service.ts` already
uses. A Prisma `Decimal` serialised as a JSON number becomes a float and silently
loses paisa on values a Bangladeshi store actually charges.

### `GET /api/ai/v1/orders`

Requires `read:orders`. Query: `limit`, `cursor`, `status`.

```json
{
  "data": [
    {
      "id": "clx…",
      "storeId": "clx…",
      "orderNumber": "1042",
      "status": "PENDING",
      "paymentStatus": "PAID",
      "currency": "BDT",
      "totalAmount": "2530.50",
      "createdAt": "2026-08-26T06:31:00.000Z",
      "customer": {
        "name": "Rahim Uddin",
        "phone": "•••••••5678",
        "email": "r••••••••••@example.com"
      },
      "shipping": { "city": "Dhaka", "district": "Dhaka" },
      "items": [
        {
          "id": "clx…",
          "productId": "clx…",
          "title": "Argan Hair Oil 100ml",
          "sku": "AR-100",
          "quantity": 2,
          "price": "1200.25",
          "total": "2400.50"
        }
      ]
    }
  ],
  "page": { "hasMore": false, "nextCursor": null },
  "storeId": "clx…"
}
```

Three groups of fields are absent by construction:

- **Fraud tooling** — `ipAddress`, `riskScore`, `riskLevel`, `riskFactors`,
  `verificationStatus`, `verifiedAt`, `markedFakeAt`, `verificationDecidedAt`.
  `riskFactors` is the worst of them: it spells out how the rule engine scores an
  order, and publishing that is publishing the evasion manual.
- **Contact details** — the phone keeps its last four digits, the email keeps
  its domain. The name is whole, because an assistant that cannot say whose order
  it is has little to offer, and a name is the seller's own record of their own
  customer. In Bangladesh the phone number _is_ the customer identity
  (`Customer` is keyed `@@unique([storeId, phone])`), which is why it is the one
  that gets masked.
- **Addresses** — city and district only. `shippingArea` and the `Address` rows
  stay behind: a district is enough to reason about courier performance, a street
  address is somebody's home.

`storeId` rides on every order because `orderNumber` is unique per store rather
than globally (`@@unique([storeId, orderNumber])`), so it is never sent alone.

### `GET /api/ai/v1/metrics`

Requires `read:analytics`. No parameters.

```json
{
  "storeId": "clx…",
  "currency": "BDT",
  "summary": {
    "totalOrders": 128,
    "totalProducts": 34,
    "pendingOrders": 6,
    "lowStockProducts": 3,
    "todayRevenue": "4820.00",
    "thisMonthRevenue": "184300.50"
  },
  "recentOrders": [
    {
      "id": "clx…",
      "orderNumber": "1042",
      "customerName": "Rahim Uddin",
      "status": "PENDING",
      "currency": "BDT",
      "totalAmount": "2530.50",
      "createdAt": "2026-08-26T06:31:00.000Z"
    }
  ],
  "topProducts": [
    {
      "productId": "clx…",
      "title": "Argan Hair Oil 100ml",
      "quantitySold": 42,
      "revenue": "50410.50"
    }
  ],
  "lowStockProducts": [
    { "id": "clx…", "title": "Rose Water 200ml", "stockQuantity": 2, "lowStockThreshold": 5 }
  ]
}
```

Every number comes from `analytics.service.ts`, which is what draws the seller's
own home page. **Not one line of arithmetic lives in the AI module** — the moment
it computed a total of its own, the AI and the dashboard could quote different
revenue for the same day and the seller would have no way to tell which was
lying.

No date range, because the underlying service takes none. The place to ask for a
windowed figure is a report, which already has one.

### `GET /api/ai/v1/reports/{reportKey}`

Requires `read:analytics`, plus `read:customers` for `overview`, `orders` and
`customers`. Query: `range` — `30d` (default), `90d`, `12m`.

`reportKey` is one of exactly eight, each mapping to a function
`report.service.ts` already exposes:

`overview` · `orders` · `revenues` · `products` · `customers` ·
`incomplete-orders` · `abandoned-carts` · `merchandising`

```json
{
  "storeId": "clx…",
  "key": "revenues",
  "range": "30d",
  "data": { "currency": "BDT", "metrics": { "gross": 184300.5, "net": 181900.5, "…": 0 }, "…": [] }
}
```

Anything else is a 404 that lists the eight. This is a transport for eight named
reports, not a query language: the key is a closed enum and the loader is a
lookup in a fixed table, so there is no path by which a caller's string becomes a
function name, a table name, or a query.

An unsupported `?range` is a 400 rather than a silent fallback to 30 days —
`parseReportRange` does fall back for the dashboard, which is right for a URL a
seller can typo and wrong for an API.

The report schemas in `AI_REPORT_SCHEMAS` are the one place on this API that
**strip** unknown keys rather than reject them. Every other response is built
field by field in the AI module, so an unknown key cannot appear and a strict
schema catches a mapper that drifted. A report is somebody else's DTO, computed
for the dashboard, and it will gain fields: stripping keeps the allow-list
exactly as binding while a new dashboard metric ships without turning this
endpoint into a 500. Adding it to the API is then a deliberate line in
`ai.schema.ts`.

### Pagination

`products` and `orders` are cursor-paginated, following
`listMediaAssetsRecord`. Read `page.nextCursor` and send it back as `?cursor=`
until `page.hasMore` is false.

Cursor rather than offset because both lists are written to while they are being
walked — an order arriving mid-walk would make `skip`/`take` repeat a row, and a
product being edited would make it skip one.

### Errors

Every non-2xx body is `{ "code": string, "message": string }`.

| Status | Code                  | Meaning                                                 |
| ------ | --------------------- | ------------------------------------------------------- |
| 400    | `invalid_query`       | a query parameter is missing, malformed or out of range |
| 401    | `invalid_credentials` | missing, malformed, or unknown key                      |
| 401    | `revoked_key`         | the key was revoked                                     |
| 401    | `expired_key`         | the key is past its expiry                              |
| 403    | `insufficient_scope`  | the key lacks the scope this endpoint requires          |
| 403    | `store_unavailable`   | the store is suspended or archived                      |
| 404    | `store_not_found`     | the key authenticated but its store is gone             |
| 404    | `unknown_report`      | no such report key; the message lists the real ones     |
| 429    | `rate_limited`        | bucket exhausted; see `Retry-After`                     |
| 500    | `internal_error`      | deliberately opaque — details go to the server log      |

`invalid_query` is the only place a Zod failure becomes a 4xx. A schema failure
anywhere else on this API is a _response_ that did not match its own contract —
our bug, not the caller's — and stays a 500.

401 responses carry `WWW-Authenticate: Bearer error="invalid_token"`. Every
response carries `cache-control: no-store`; successful ones carry
`X-RateLimit-Limit` and `X-RateLimit-Remaining`.

---

## How StoreOS AI will consume this

Today the integration is one-way. [`packages/storeos-sdk`](../packages/storeos-sdk)
calls _out_ to StoreOS — `createNativeConnection`, `sendChatMessage` — and the
context it sends is `{ platformType, storeId }` and nothing else. StoreOS AI has
no way to read a store and no way to act on one. `executeAction()` exists in the
SDK and is called from nowhere.

This API is the return path, and as of this phase it is usable:

1. A seller goes to **Dashboard → Settings → Integrations**, names a key, ticks
   the scopes they are willing to grant, and creates it. The raw key is shown
   once, with a Copy button and a warning that it will not be shown again.
2. It is handed to StoreOS alongside the existing connection, and stored there as
   the credential for this tenant.
3. StoreOS AI calls `GET /api/ai/v1/context` to confirm the key works and to
   learn the store's currency and timezone.
4. Per question, it calls the read endpoint that answers it — `/metrics` for "how
   did today go", `/products?search=` for "how many of these are left",
   `/orders?status=PENDING` for "what is waiting to ship",
   `/reports/revenues?range=90d` for a trend. Each is one existing service call
   behind `withAiApiRoute` and its own scope. Nothing is pushed; the AI asks.
5. The seller revokes the key from the same page when they are done, and the very
   next request fails.

**A note for the StoreOS side:** the API contract is unchanged from what the SDK
already assumes — this is a new base URL and a bearer token, not a change to
`createNativeConnection` or `sendChatMessage`. Nothing in `packages/storeos-sdk`
had to move for this phase.

### Not yet built

Deliberately out of scope, in rough order of likely need:

- **AI write actions.** The `write:*` scopes exist in the vocabulary and cannot
  be granted. `executeAction()` in the SDK is still called from nowhere.
- **Outbound webhooks.** There is no outbound webhook infrastructure in this
  codebase at all — inbound courier callbacks are the only precedent. Until
  there is, StoreOS AI polls; it is not told when an order arrives.
- **Single-resource reads** (`GET /products/{id}`, `GET /orders/{id}`). The list
  endpoints cover the questions an assistant asks today.
- **A distributed rate limiter.** See the limitation above.
- **Customer and inventory endpoints.** `read:customers` currently only unlocks
  the customer-naming reports; there is no `/customers` list, which is the right
  default until somebody has a reason for one.

---

## Operational notes

**Schema.** `StoreApiKey` is added to
[`schema.prisma`](../packages/db/prisma/schema.prisma). This repo has no
`migrations/` directory — `npm run db:push` is the sync path. The change is purely
additive: one `CREATE TABLE`, a unique index on `tokenHash`, an index on
`storeId`, and a cascading foreign key to `Store`. Nothing is dropped or altered.

```bash
npm run db:push
npm run db:generate
```

**Environment.** None. The AI API adds no environment variable: keys live in the
database, and there is no shared secret to configure.

**Checks.** `npm run verify:ai-api` exercises the API against a real database
with throwaway fixtures. It follows the same convention as the other `verify:*`
scripts; there is still no test runner in this repo.

Two layers are driven. The credential checks call `resolveApiKeyStore` directly —
valid, unknown, revoked and expired keys, every malformed header shape, scope
enforcement, cross-store isolation, and assertions that the raw key reaches
neither the database nor any log. The endpoint checks call the exported route
handlers with real `NextRequest` objects, so what is asserted is the status,
headers and JSON an external caller actually receives, with the auth wrapper, the
scope check and the throttle in the path.

The fixtures are built to fail loudly: the test product carries a `costPrice`,
the test order carries an `ipAddress` and a full fraud assessment, and every
successful response body is scanned as a raw substring for every RED field from
the audit. If a redaction ever regresses, a check goes red rather than a customer
list going out.
