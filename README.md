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

Copy `.env.example` to `.env.local` when local environment values are needed. Auth, products, orders, payments, and StoreOS integration are intentionally not implemented yet.

## Database Setup

Dash Commerce OS uses Prisma with PostgreSQL from `packages/db`.

Create a local PostgreSQL database, then copy the example environment file:

```bash
cp .env.example .env
```

Set `DATABASE_URL` in `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dash_commerce?schema=public"
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

The current schema covers users, organizations, organization memberships, stores, and store domains only. Product, order, customer, payment, auth UI, and StoreOS integration models are intentionally not implemented yet.
