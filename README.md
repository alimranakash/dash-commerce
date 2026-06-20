# Dash Commerce OS

Dash Commerce OS is a production-grade multi-tenant SaaS commerce platform. This repository starts with a clean Turborepo foundation for a scalable Next.js and TypeScript codebase.

## Monorepo Structure

- `apps/web` - Main Next.js App Router application. It will later serve the marketing site, seller dashboard, and tenant storefronts.
- `apps/worker` - TypeScript Node worker placeholder for future background jobs.
- `packages/db` - Shared Prisma/PostgreSQL database package.
- `packages/ui` - Shared React UI primitives.
- `packages/config` - Shared TypeScript and ESLint configuration.
- `packages/types` - Shared TypeScript domain types.
- `packages/storeos-sdk` - Placeholder for the future StoreOS API SDK.

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

Copy `.env.example` to `.env.local` when local environment values are needed. StoreOS integration and live courier/payment gateway APIs are intentionally not implemented yet.

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

The current schema covers users, Auth.js accounts and sessions, organizations, stores, products, categories, carts, checkout orders, store settings, payment methods, and manual shipping zones/rates. Run `npm run db:push` after pulling schema changes so the local database has the newest columns and tables.

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
