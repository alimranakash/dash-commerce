# StoreIM

StoreIM is a production-grade multi-tenant SaaS commerce platform. This repository starts with a clean Turborepo foundation for a scalable Next.js and TypeScript codebase.

## Monorepo Structure

- `apps/web` - Main Next.js App Router application. It will later serve the marketing site, seller dashboard, and tenant storefronts.
- `apps/worker` - TypeScript Node worker placeholder for future background jobs.
- `packages/db` - Shared Prisma/PostgreSQL database package.
- `packages/ui` - Shared React UI primitives.
- `packages/config` - Shared TypeScript and ESLint configuration.
- `packages/types` - Shared TypeScript domain types.
- `packages/storeos-sdk` - Typed StoreOS native connector SDK used by the StoreIM web app.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Build all apps and packages:

```bash
npm run build
```

Run linting and type checks:

```bash
npm run lint
npm run typecheck
```

Copy `.env.example` to `.env.local` when local environment values are needed. Live courier/payment gateway APIs are intentionally not implemented yet.

## Database Setup

StoreIM uses Prisma with PostgreSQL from `packages/db`.

Create a local PostgreSQL database, then copy the example environment file:

```bash
cp .env.example .env
```

Set `DATABASE_URL` in `.env`:

```bash
DATABASE_URL="postgresql://postgres:root123@localhost:5432/storeos?schema=dash_commerce"
```

Generate the Prisma client:

```bash
npm run db:generate
```

Push the schema during early local development:

```bash
npm run db:push
```

Create a migration when schema changes should be committed:

```bash
npm run db:migrate
```

Open Prisma Studio:

```bash
npm run db:studio
```

The current schema covers users, Auth.js accounts and sessions, organizations, stores, products, categories, carts, checkout orders, store settings, payment methods, manual shipping zones/rates, StoreOS native connections, and store-scoped media assets. Run `npm run db:push` after pulling schema changes so the local database has the newest columns and tables.

## Authentication Setup

The web app uses NextAuth with a Prisma adapter and credentials login. Set these values in `.env`:

```bash
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
```

Create a Google OAuth 2.0 Web application and add these authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://app.storeim.com/api/auth/callback/google
```

Production `NEXTAUTH_URL` must use the same canonical seller-app origin (`https://app.storeim.com`). Google OAuth redirect URIs do not support wildcard hosts. If you run the web app on another port, update both `NEXTAUTH_URL` and the Google callback URI to match it. After schema changes, sync the database and generate the Prisma client:

```bash
npm run db:push
npm run db:generate
```

Then start the app:

```bash
npm run dev
```

Visit `/register`, create an account with Google or credentials, then use `/login`, `/dashboard`, and the dashboard sign-out button. Google users are created through the Prisma adapter; a verified Google email can also link to an existing credentials account with the same email.

## Shipping Setup

New stores automatically receive two enabled shipping zones and rates:

- Inside Dhaka: 70 BDT
- Outside Dhaka: 130 BDT

Existing stores are safely backfilled when the shipping settings page or checkout loads. Sellers can manage zones and flat rates at:

```bash
/dashboard/shipping
```

Checkout only shows enabled rates whose zone is also enabled. The selected rate is reloaded server-side during order creation, and the order stores a snapshot of the delivery method and shipping amount.

## StoreOS Setup

StoreOS is the central AI engine behind StoreIM AI. The link to it is **operator configuration, not merchant configuration**: one deployment talks to one StoreOS installation with one credential, and a seller never sees, sets, or needs to know it. Set these server-only values in `.env`:

```bash
STOREOS_API_URL="https://api.storeos.example"
STOREOS_API_KEY="replace-with-storeos-api-key"
```

With them set, a seller connects their own store by clicking **Connect / reconnect StoreIM AI** on `/dashboard/ai`. That runs a server action which resolves the store from the session, derives the store's identity (id, name, slug, subdomain, verified custom domain, currency, country, timezone) from its own row, and opens a server-to-server connection. Nothing about the credential — including whether it is set — reaches the browser.

Without them, onboarding still succeeds, the connection stays pending, and the AI Assistant shows "Not connected" with a fallback chat response. The seller is told the platform has not switched StoreIM AI on yet, because that is the operator's job and there is nothing for them to configure.

`npm run verify:storeim-ai` is the executable check for this layer.

## Media Storage

Local development uploads use the `local` storage driver and write files under `apps/web/public/uploads`. Uploaded asset records are stored per store in PostgreSQL.

```bash
STORAGE_DRIVER="local"
STORAGE_PUBLIC_URL=
```

The S3/R2-compatible environment placeholders are present for the production driver foundation:

```bash
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
```

Manage uploaded media at `/dashboard/media`, then use the uploaded URLs in product, store settings, and theme forms.
