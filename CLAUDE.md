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
- [modules/storefront/templates/template-store.ts](apps/web/src/modules/storefront/templates/template-store.ts), [modules/settings/settings.repository.ts](apps/web/src/modules/settings/settings.repository.ts) — raw read/write of columns the generated client may not know about

Each of these re-derives the schema name from `DATABASE_URL` through a local `getDatabaseSchemaName()` (validated against `/^[A-Za-z_][A-Za-z0-9_]*$/`, falling back to `public`). If you add a column that these paths touch, update `schema.prisma` **and** the corresponding `ensure*Schema` DDL, and run `db:push` + `db:generate`. Consider whether a real migration is preferable before extending the pattern further.

The Prisma client is generated to `packages/db/src/generated/prisma` (gitignored, eslint-ignored) and uses `@prisma/adapter-pg` with an explicit `schema`. `packages/db/src/client.ts` caches the client on `globalThis` behind a `PRISMA_CLIENT_SIGNATURE` string — bump that constant when a regenerated client must not be reused across dev hot reloads.

## Conventions

- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` ([packages/config/tsconfig/base.json](packages/config/tsconfig/base.json)). Consequences you will hit: type-only imports must use `import type`, indexed access yields `T | undefined`, and optional props must be declared `key?: T | undefined` — hence the `...(x ? { x } : {})` spread idiom used throughout the repositories.
- Relative imports within `apps/web` (`../../lib/auth`); no path aliases are configured. Cross-package imports use `@dash/*`.
- Prettier: double quotes, no trailing commas, 100 columns, semicolons.
- Lint runs with `--max-warnings=0`, and `@typescript-eslint/consistent-type-imports` is a warning — so a missing `import type` fails CI-equivalent checks.
- Object literal keys are largely alphabetized; match surrounding style.
- Currency is BDT and new stores are auto-seeded with Inside/Outside Dhaka shipping zones (70/130 BDT) — the product is Bangladesh-oriented.
- Courier and payment-gateway integrations are intentionally stubs; StoreOS calls no-op gracefully when `STOREOS_API_URL`/`STOREOS_API_KEY` are unset.

See [README.md](README.md) for environment-variable setup, Google OAuth redirect URIs, and media-storage drivers.
