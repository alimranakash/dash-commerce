# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root (npm workspaces + Turborepo):

```bash
npm run dev          # turbo dev --filter=@dash/web  (Next dev server on :3000)
npm run build        # build all apps/packages
npm run lint         # eslint . --max-warnings=0 in every workspace
npm run typecheck    # tsc --noEmit in every workspace
npm run format       # prettier --write .

npm run db:generate  # prisma generate  -> packages/db/src/generated/prisma
npm run db:push      # prisma db push (primary schema-sync path; see below)
npm run db:migrate   # prisma migrate dev
npm run db:studio
```

Scope a task to one workspace with `turbo <task> --filter=@dash/web` or `npm run <script> -w @dash/web`.

There is **no test framework configured** in this repo — no test runner, no test files, no `test` script. `lint` + `typecheck` are the only automated checks; run both before declaring work done.

### Environment

`.env` lives at the **repo root**, not in `apps/web`. `.env.local` overrides it. Loading is explicit rather than Next-implicit: [apps/web/src/lib/env.ts](apps/web/src/lib/env.ts), [packages/db/src/client.ts](packages/db/src/client.ts), and [prisma.config.ts](prisma.config.ts) each `dotenv.config()` the root `.env` and `.env.local`. Turbo tasks run with `--env-mode=loose` so vars pass through.

`DATABASE_URL` carries a `?schema=` search param (e.g. `...?schema=dash_commerce`). That schema name is parsed at runtime and used both by the Prisma pg adapter and by hand-written raw SQL — see below.

## Architecture

Monorepo: `apps/web` (the whole product), `apps/worker` (placeholder), `packages/db` (Prisma), plus `packages/ui`, `packages/types`, `packages/config`, `packages/storeos-sdk`. Nearly all real code is in `apps/web`.

### One Next.js app, four surfaces, split by hostname

[apps/web/src/proxy.ts](apps/web/src/proxy.ts) (Next 16 `proxy`, the successor to `middleware`) reads the `Host` header, calls `resolveStoreFromHost` in [apps/web/src/lib/host-routing.ts](apps/web/src/lib/host-routing.ts), and **rewrites** storefront traffic:

| Host | Surface | Routes |
| --- | --- | --- |
| `storeim.com`, `localhost` | marketing | `/` |
| `app.storeim.com` | seller app + platform admin | `/dashboard/**`, `/admin/**`, `/login`, `/register` |
| `<slug>.storeim.com`, `<slug>.localhost` | tenant storefront | rewritten to `/s/<slug>/**` |
| any other domain | custom-domain storefront | resolved to a store, then rewritten to `/s/<slug>/**` |

`/admin`, `/dashboard`, `/login`, `/register` are never rewritten, so they stay reachable on any host.

The hostnames in that table are defaults: `PLATFORM_ROOT_DOMAIN` and `PLATFORM_APP_HOST` override them, and a deployed server must set them since new stores' subdomains and TLS authorisation both derive from the root domain. Caddy's on-demand TLS asks [/api/domains/authorize](apps/web/src/app/api/domains/authorize/route.ts) before issuing a certificate for any hostname; [deploy/Caddyfile](deploy/Caddyfile) is the reference config.

A custom domain is resolved by `resolveCustomDomainRoute` in [modules/domains/domain-routing.ts](apps/web/src/modules/domains/domain-routing.ts) — a cached lookup that only matches a **verified** `StoreDomain` row of type `CUSTOM` on a live store. Unresolved hosts are rewritten to `/domain-not-configured`; nothing renders a storefront for them. Because the storefront components hardcode `/s/<slug>/…` hrefs, the proxy also 308-redirects `/s/<slug>/*` back to the bare path on a custom domain, which is what keeps `worzen.com/products` in the address bar. `proxy.ts` is a Node-runtime entry (Next builds `proxy` server-side only), so it can query Prisma directly.

**`app/s/[slug]/**` files are one-line re-exports of `app/storefront/[slug]/**`.** `/s/` is the rewrite target; `/storefront/` holds the real implementations. When adding a storefront route, write it under `app/storefront/[slug]/` and add the matching `export { default } from ...` stub under `app/s/[slug]/`.

### Module layering (`apps/web/src/modules/<domain>/`)

Almost every domain follows the same file quartet, and new code should match it:

- `*.schema.ts` — Zod input schemas, exported as both schema and inferred type.
- `*.repository.ts` — the only place that touches `prisma` for that domain. Every query is scoped by `storeId`.
- `*.service.ts` — parses input with the Zod schema, enforces invariants (slug/SKU uniqueness, cross-store ownership), calls repository functions.
- `*.actions.ts` — `"use server"` entry points. Resolve the tenant first (`requireStore()`), then delegate to the service, then `revalidatePath` / `redirect`. Server actions are the primary mutation path; `app/api/**` routes exist only for auth, cart, checkout, onboarding, and a few REST-ish product/category endpoints.
- `components/` — the React components for that domain, imported by thin `app/**/page.tsx` files.

### Tenancy and authorization

Chain is `User -> Organization -> OrganizationMember -> Store -> everything else`. Guards:

- `requireUser()` / `getCurrentUser()` in [apps/web/src/lib/auth.ts](apps/web/src/lib/auth.ts) — redirect to `/login`.
- `requireStore()` in [apps/web/src/modules/stores/queries.ts](apps/web/src/modules/stores/queries.ts) — resolves the current org's store; redirects to `/dashboard` if absent. **Every server action starts here**; the returned `store.id` is what scopes all repository calls.
- `requirePlatformAdmin()` in [apps/web/src/modules/admin/admin.auth.ts](apps/web/src/modules/admin/admin.auth.ts) — gates `/admin/**` on `role === "ADMIN"`.

NextAuth v4, JWT sessions, Prisma adapter, Credentials + Google (Google provider is only registered when both `GOOGLE_CLIENT_ID`/`SECRET` are set). `role` and `id` are threaded onto the token and session via callbacks. Note `platformOwnerEmail` is a hardcoded constant in `lib/auth.ts` that force-promotes one account to `ADMIN` on every sign-in and JWT refresh.

### Storefront rendering: templates vs. themes

Two separate registries, easy to confuse:

- **Templates** ([modules/storefront/templates/](apps/web/src/modules/storefront/templates/)) — per-business-type React implementations (`beauty-default`, `electronics-default`, `fashion-default`, `general-default`). Each `config.ts` implements `StorefrontTemplateConfig`: homepage sections, product card, product-page layout, category layout, default colors. `getStorefrontTemplateForStore(store)` picks by `store.activeTemplate`, falling back to business type, then `general-default`. Pages pull components off the config rather than branching on template id.
- **Themes** ([modules/storefront/themes/](apps/web/src/modules/storefront/themes/)) — layout/CSS-variable layer, currently just `default`. Seller-editable values live in `ThemeSetting`.
- **Demo packs** ([modules/demo-packs/](apps/web/src/modules/demo-packs/)) — seedable demo catalogs (products, categories, homepage, media) mapped 1:1 to templates via `templateDemoPackMap`. Assets live in `apps/web/public/demo-assets/<vertical>/`.

Adding a vertical means touching all three registries plus `template-mapping.ts`.

`modules/storefront/resolver.ts` is the read layer for storefront pages: `requireStorefrontBySlug` / `requireStorefrontByDomain` load store + settings + theme, lazily backfill defaults via `ensureDefaultSettingsForStore`, and `notFound()` otherwise.

### Self-healing schema via raw SQL — important quirk

`packages/db/prisma/` contains **`schema.prisma` only, no `migrations/` directory**. The workflow is `db:push`, and several features additionally patch the live database at request time with idempotent DDL:

- [modules/demo-packs/demo-schema.ts](apps/web/src/modules/demo-packs/demo-schema.ts) — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for demo-content columns
- [modules/categories/category-image-schema.ts](apps/web/src/modules/categories/category-image-schema.ts) — memoized `ensureCategoryImageSchema()`, awaited at the top of most storefront reads
- [modules/products/product-taxonomy.service.ts](apps/web/src/modules/products/product-taxonomy.service.ts), [product-variants.service.ts](apps/web/src/modules/products/product-variants.service.ts) — `CREATE TABLE IF NOT EXISTS` for taxonomy/variant tables
- [modules/product-content/product-content.repository.ts](apps/web/src/modules/product-content/product-content.repository.ts) — `CREATE TABLE IF NOT EXISTS` for `ProductContent`, the AI content studio's satellite row
- [modules/ai-provider/ai-provider.repository.ts](apps/web/src/modules/ai-provider/ai-provider.repository.ts) — `CREATE TABLE IF NOT EXISTS` for `StoreAiSetting`, the store's AI provider configuration
- [modules/storefront/templates/template-store.ts](apps/web/src/modules/storefront/templates/template-store.ts), [modules/settings/settings.repository.ts](apps/web/src/modules/settings/settings.repository.ts) — raw read/write of columns the generated client may not know about

Each of these re-derives the schema name from `DATABASE_URL` through a local `getDatabaseSchemaName()` (validated against `/^[A-Za-z_][A-Za-z0-9_]*$/`, falling back to `public`). If you add a column that these paths touch, update `schema.prisma` **and** the corresponding `ensure*Schema` DDL, and run `db:push` + `db:generate`. Consider whether a real migration is preferable before extending the pattern further.

The Prisma client is generated to `packages/db/src/generated/prisma` (gitignored, eslint-ignored) and uses `@prisma/adapter-pg` with an explicit `schema`. `packages/db/src/client.ts` caches the client on `globalThis` behind a `PRISMA_CLIENT_SIGNATURE` string — bump that constant when a regenerated client must not be reused across dev hot reloads.

### Uploaded media is served by a route, not by `public/`

Uploads are written to `apps/web/public/uploads/stores/<storeId>/` ([modules/media/storage.ts](apps/web/src/modules/media/storage.ts)) but read back through [app/uploads/[...key]/route.ts](apps/web/src/app/uploads/%5B...key%5D/route.ts). That is not redundant: `next start` walks `public/` once at boot and answers static requests from that snapshot alone, so in production a file an upload writes afterwards 404s until the service restarts — while `next dev` stats the disk on each miss and works, so the bug only ever appears on the server. Do not delete that route. Do not move the directory out of `public/` either: the deploy workflow's `--exclude='apps/web/public/uploads/'` and the systemd unit's `ReadWritePaths` both name it, with `rsync --delete` waiting for anyone who moves it without updating both.

## Conventions

- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` ([packages/config/tsconfig/base.json](packages/config/tsconfig/base.json)). Consequences you will hit: type-only imports must use `import type`, indexed access yields `T | undefined`, and optional props must be declared `key?: T | undefined` — hence the `...(x ? { x } : {})` spread idiom used throughout the repositories.
- Relative imports within `apps/web` (`../../lib/auth`); no path aliases are configured. Cross-package imports use `@dash/*`.
- Prettier: double quotes, no trailing commas, 100 columns, semicolons.
- Lint runs with `--max-warnings=0`, and `@typescript-eslint/consistent-type-imports` is a warning — so a missing `import type` fails CI-equivalent checks.
- Object literal keys are largely alphabetized; match surrounding style.
- Currency is BDT and new stores are auto-seeded with Inside/Outside Dhaka shipping zones (70/130 BDT) — the product is Bangladesh-oriented.
- **Plan gating has one shape, and both halves are required.** Entitlements are hierarchical by construction — `GROWTH_FEATURES` is spread from `STARTER_FEATURES`, `PRO_FEATURES` from `GROWTH_FEATURES` in [plan-catalog.ts](apps/web/src/modules/admin/plan-catalog.ts) — so a tier grants its own keys and every key below, and nothing above. Enforcement is `requirePlanFeature(storeId, key)` in the **service or action that writes**, never only in the page that renders the form; `hasPlanFeature` is for display. The refusal then has to reach the seller as the shared upgrade dialog rather than a red box: catch `PlanFeatureError`, return `lockedFeature: error.featureKey` on the action state, and have the client form call `openUpgrade(state.lockedFeature)` from `useUpgradePrompt()` (mounted once by `DashboardShell`) while suppressing its own inline message for that case. Actions that report by redirecting instead of by action state send `?locked=<key>`, which the page narrows with `isPlanFeatureKey` and hands to [`LockedFeaturePrompt`](apps/web/src/modules/billing/components/locked-feature-prompt.tsx). One consistent exception runs through the whole codebase: the entitlement buys **authoring**, so deactivating, deleting and switching off are left ungated — a lapsed store must always be able to stop a live coupon, bundle, redirect, SMS or storefront assistant. `npm run verify:plan-features` checks the matrix.
- **Two separate AI credentials, and they must not be confused.** `STOREOS_API_KEY` is the *operator's* platform link (see below). `StoreAiSetting` is the *merchant's* own Gemini or OpenAI key, entered in StoreIM AI > Settings, encrypted with [lib/secret-box.ts](apps/web/src/lib/secret-box.ts) and decrypted in exactly one place — `resolveAiProvider` in [modules/ai-provider/ai-provider.service.ts](apps/web/src/modules/ai-provider/ai-provider.service.ts). Neither key ever reaches the browser: the dashboard is sent `AiSettingsView`, which carries booleans and a last-four hint. Product-content generation tries the store's provider, then StoreOS, then an offline composer, and always labels which one wrote the draft ([modules/product-content/](apps/web/src/modules/product-content/)). `npm run verify:product-content` asserts all of this without a database.
- **The AI Store Copilot is the in-app half of the AI API.** [modules/store-copilot/](apps/web/src/modules/store-copilot/) is the StoreIM AI > AI Store Copilot brain: a merchant asks about sales, orders, products, customers or stock and the answer is built from `modules/ai/*.service.ts` — the same redacted, store-scoped read layer `/api/ai/v1/**` serves, so the chat cannot quote a total the dashboard disagrees with. The model only names tools from a closed enum and *proposes* changes; `storeCopilotActionSchema` is built from the AI API's own body schemas, so a proposal either parses into something `createAiCoupon` / `updateAiProduct` / `setAiOrderStatus` can already execute or it produces no Confirm button at all. Nothing is written until the merchant confirms, and each change is logged with `via: "store-copilot"` naming the person who approved it. It runs on the merchant's own provider key or, with none, on a deterministic briefing over the same figures — never on a platform engine. **StoreIM AI is a paid entitlement, and the plan is the only thing that grants it**: three separate feature keys — `ai_copilot`, `ai_product_content` (Starter up) and `ai_shopping_agent` (Growth up) — gate the three surfaces, because they are not one purchase. A store's own Gemini/OpenAI credential decides *which engine answers* — `resolveAiProvider` is preferred over the platform's, and it is what buys a real conversation over the deterministic briefing — but it is **never** a second way to qualify: an `ownKey || planGrants` read is exactly the bug this rule exists to prevent, and `verify-plan-features` asserts against that shape in all three services. `aiEnabled` is the pricing table's "this plan includes some StoreIM AI" flag and must agree with the union of the three keys; the sidebar badges each StoreIM AI row from its own key. `npm run verify:store-copilot` asserts all of this without a database.
- **The AI Shopping Agent is the customer-facing one.** [modules/shopping-agent/](apps/web/src/modules/shopping-agent/) puts a chat launcher on every storefront page: a shopper describes what they want in English or Bangla, and the agent searches, recommends, compares, adds to the cart and takes them through to a placed order and its payment link. Same two-turn JSON shape as the copilot, and the same discipline — a closed tool enum, proposals rather than writes, and a Confirm button the shopper presses. What makes it not a second commerce system is that every layer is borrowed: reads go through `storefront/resolver.ts` (so `publicProductWhere` means a DRAFT or HIDDEN product can no more be recommended than linked), the cart goes through `cart.service.ts` (the same signed cookie the header counts), and the order goes through `createCheckoutOrder` — the identical function `/api/checkout` posts to, so stock, coupons, bundles, the blocklist, plan limits, fraud scoring and the one-submission-one-order index all still apply. The post-order side effects moved to [checkout-completion.ts](apps/web/src/modules/checkout/checkout-completion.ts) so the route and the agent share one copy; a shop that verifies phone numbers on COD is handed to the checkout page instead, because there is no way to run an SMS exchange in a chat bubble. **Products are re-read, never quoted**: the model returns ids, the server draws each card from the catalogue row, so an invented id produces no card and no Confirm button. Tenancy has no session to lean on — the store comes from the storefront slug through `getStorefrontBySlug`, which is exactly what visiting that storefront would have read — so nothing private is on the other side of a slug, and no payload may name a `storeId`. Two gates, both required: the `ai_shopping_agent` plan entitlement, and `StoreAiSetting.shoppingAgentEnabled`, which is **off by default** and lives on its own StoreIM AI > AI Shopping Agent page — an entitled plan must never publish a public assistant by itself. Switching it **on** goes through `requirePlanFeature` in `saveShoppingAgentSettingsAction`, so an unentitled store cannot store a `true` that would go live later; switching it **off** is deliberately ungated, the line the coupon, bundle and blocklist gates also draw. With no key it runs a deterministic guided assistant over the same search index rather than nothing. `npm run verify:shopping-agent` asserts all of this without a database.
- **The sitemap and `robots.txt` are per-hostname, and they answer for four surfaces.** [modules/seo/](apps/web/src/modules/seo/) serves `/sitemap.xml`, `/sitemap/<section>.xml` and `/robots.txt`. They are route handlers rather than Next's `app/sitemap.ts` convention because the answer depends on the `Host`: `proxy.ts` skips any path with a file extension, so these three reach Next exactly as the browser asked for them and resolve the store themselves through the storefront's own `getStorefrontBySlug` / `getStorefrontByDomain`. A hostname that would not render a shop gets no sitemap for one. Store status is deliberately *not* consulted: `DRAFT` is the status every store is created with and only a platform admin can change it, so servable and indexable are one question. Two rules hold the thing together. Products are narrowed by the resolver's exported `publicProductWhere`, so a DRAFT or HIDDEN product can no more be submitted to a crawler than linked; and the sitemap's omissions and `robots.ts`'s `Disallow` lines are the same decision written twice, so every storefront route must be submitted, disallowed, or a known redirect. The document builders in `sitemap-documents.ts` are pure functions over rows, which is what lets `npm run verify:sitemap` drive real XML without a database.
- **A sitemap is only worth as much as the canonical tags on the URLs it names.** Every storefront page under the layout inherits its metadata, so a page without its own `generateMetadata` canonicalises to the store's homepage — which would make a sitemap of products self-defeating. `storefrontCanonicalUrl` in [modules/seo/page-metadata.ts](apps/web/src/modules/seo/page-metadata.ts) is the one helper for it, and the canonical deliberately differs from the sitemap's origin: a sitemap may only list URLs beneath its own location, so it uses the host it was requested on, while the canonical points at the store's primary domain and folds the two together. Both halves of an `app/s/[slug]/**` stub matter — a stub that re-exports only `default` silently drops the page's metadata, since `/s/` is what a storefront request actually renders.
- Courier and payment-gateway integrations are intentionally stubs; StoreOS calls no-op gracefully when `STOREOS_API_URL`/`STOREOS_API_KEY` are unset. Those two are **operator** config for the whole deployment, never merchant config: a seller connects StoreIM AI by clicking one button, and nothing about the credential — not its value, not whether it is set — may reach the browser. `modules/storeos/` keeps that boundary: `storeos-identity.ts` re-derives the store envelope server-side from the store row, `storeos-connection-state.ts` collapses the row plus link state into the phase and sentence the UI renders, and `storeos-capabilities.ts` declares the future AI surfaces (Product, Marketing, Customer, Order, Analytics, Automation) that will share the same connection. AI orchestration itself belongs in StoreOS, not here.

See [README.md](README.md) for environment-variable setup, Google OAuth redirect URIs, and media-storage drivers.
