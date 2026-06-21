# Dash Commerce OS

Dash Commerce OS is a production-grade multi-tenant SaaS commerce platform. This repository starts with a clean Turborepo foundation for a scalable Next.js and TypeScript codebase.

## Monorepo Structure

- `apps/web` - Main Next.js App Router application. It will later serve the marketing site, seller dashboard, and tenant storefronts.
- `apps/worker` - TypeScript Node worker placeholder for future background jobs.
- `packages/db` - Shared Prisma/PostgreSQL database package.
- `packages/ui` - Shared React UI primitives.
- `packages/config` - Shared TypeScript and ESLint configuration.
- `packages/types` - Shared TypeScript domain types.
- `packages/storeos-sdk` - Typed StoreOS native connector SDK used by the Dash web app.

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

Dash Commerce OS uses Prisma with PostgreSQL from `packages/db`.

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
```

If you run the web app on another port, update `NEXTAUTH_URL` to match it. After schema changes, sync the database and generate the Prisma client:

```bash
npm run db:push
npm run db:generate
```

Then start the app:

```bash
npm run dev
```

Visit `/register`, create an account, then use `/login`, `/dashboard`, and the dashboard sign-out button.

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

Dash can create a native StoreOS connection per store and route AI Assistant messages through the Dash backend. Set these server-only values in `.env`:

```bash
STOREOS_API_URL="https://api.storeos.example"
STOREOS_API_KEY="replace-with-storeos-api-key"
```

If these values are missing, onboarding still succeeds and the StoreOS connection stays pending. Sellers can retry from `/dashboard/settings`, and they can open the AI Assistant at `/dashboard/ai`.

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
